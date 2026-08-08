<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\Product;
use App\Models\ProductSale;
use App\Models\ProductSaleItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Ringing up a sale, and putting one back.
 *
 * Both directions move stock and money, so both live here rather than in a
 * controller — the same rule the rest of this project follows for
 * `RefundService` and `SubscriptionRenewalService`.
 *
 * Stock is read and written **inside one transaction with the rows locked**.
 * This project already shipped a double-booking race by doing read-then-write
 * without a lock; two staff selling the last bottle at once is that same bug
 * with a different table, and it ends with stock going negative.
 */
class PosService
{
    public const METHODS = ['cash', 'transfer'];

    /**
     * @param  array<int, array{productId: string, quantity: int}>  $lines
     *
     * @throws ValidationException when a product is missing, inactive, or short of stock
     */
    public function sell(Organization $org, array $lines, string $method, ?User $seller = null): ProductSale
    {
        if ($lines === []) {
            throw ValidationException::withMessages(['items' => 'ยังไม่ได้เลือกสินค้า']);
        }

        // Merge duplicate lines first: two taps on the same bottle is one line
        // of quantity 2, and checking them separately would let each pass a
        // stock check the pair fails.
        $wanted = [];
        foreach ($lines as $line) {
            $id = $line['productId'];
            $wanted[$id] = ($wanted[$id] ?? 0) + (int) $line['quantity'];
        }

        return DB::transaction(function () use ($org, $wanted, $method, $seller) {
            // Locked in a stable order, so two tills buying the same two items
            // in opposite orders cannot deadlock against each other.
            $products = Product::query()
                ->forOrganization($org->id)
                ->whereIn('id', array_keys($wanted))
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $sale = ProductSale::create([
                'organization_id' => $org->id,
                'code' => $this->nextCode(),
                'total' => 0,
                'payment_method' => $method,
                'status' => 'completed',
                'sold_by' => $seller?->id,
                'sold_at' => now(),
            ]);

            $total = 0.0;

            foreach ($wanted as $productId => $quantity) {
                $product = $products->get($productId);

                if (! $product || ! $product->is_active) {
                    throw ValidationException::withMessages([
                        'items' => 'มีสินค้าที่ไม่พบหรือปิดขายอยู่ในรายการ',
                    ]);
                }

                if ($quantity < 1) {
                    throw ValidationException::withMessages([
                        'items' => "จำนวนของ {$product->name} ต้องมากกว่า 0",
                    ]);
                }

                if ($product->stock_qty < $quantity) {
                    // Named, with the number — the person at the till has a
                    // customer waiting and needs to know what to put back.
                    throw ValidationException::withMessages([
                        'items' => "{$product->name} เหลือ {$product->stock_qty} ชิ้น ขาย {$quantity} ไม่ได้",
                    ]);
                }

                $lineTotal = round($product->price * $quantity, 2);
                $total += $lineTotal;

                ProductSaleItem::create([
                    'product_sale_id' => $sale->id,
                    'product_id' => $product->id,
                    // Snapshots: a later rename or reprice must not rewrite this
                    // receipt.
                    'name' => $product->name,
                    'unit_price' => $product->price,
                    'quantity' => $quantity,
                    'line_total' => $lineTotal,
                ]);

                $product->decrement('stock_qty', $quantity);
            }

            $sale->update(['total' => round($total, 2)]);

            return $sale->fresh(['items', 'seller']);
        });
    }

    /**
     * Void a sale and put the stock back.
     *
     * A void is a new fact rather than an edit: the receipt keeps its number,
     * its lines and its seller, and gains a reason. Deleting it would leave a
     * hole in the day's takings that nobody could explain.
     */
    public function void(ProductSale $sale, ?string $reason = null): ProductSale
    {
        if ($sale->isVoided()) {
            throw ValidationException::withMessages(['id' => 'รายการนี้ถูกยกเลิกไปแล้ว']);
        }

        return DB::transaction(function () use ($sale, $reason) {
            foreach ($sale->items()->whereNotNull('product_id')->get() as $item) {
                Product::query()
                    ->where('id', $item->product_id)
                    ->lockForUpdate()
                    ->first()
                    ?->increment('stock_qty', $item->quantity);
            }

            $sale->update([
                'status' => 'voided',
                'voided_at' => now(),
                'void_reason' => $reason,
            ]);

            return $sale->fresh(['items', 'seller']);
        });
    }

    /** Short, readable on a receipt, and unique. */
    private function nextCode(): string
    {
        return 'SL'.now()->format('ymd').Str::upper(Str::random(4));
    }
}
