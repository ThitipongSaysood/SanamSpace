<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerPackage;
use App\Services\CreditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * What a customer holds with the venue, and how staff change it.
 *
 *   - credit — baht. Tops up, refunds, staff adjustments. Pays for anything.
 *   - hours  — court time bought ahead as a package, at a discount.
 *
 * Shown side by side and adjusted separately, never summed: converting hours to
 * money needs a rate nobody has agreed on, and a venue selling "10 ชม. ฿2,500"
 * has not promised an hour is worth ฿250 forever.
 */
class CustomerCreditController extends Controller
{
    public function __construct(private CreditService $credit) {}

    /**
     * GET /owner/customer-credit — everyone who holds something, and everyone
     * who could.
     *
     * `?holding=1` narrows to customers with a balance, which is the list staff
     * actually work from; the full list is for finding someone to grant to.
     */
    public function index(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $customers = Customer::query()
            ->forOrganization($orgId)
            ->withSum(['packages as credit_hours' => fn ($q) => $q->where('status', 'active')], 'remaining_hours')
            ->with(['wallet', 'packages' => fn ($q) => $q->where('status', 'active')->orderBy('expires_at')])
            ->when($request->filled('q'), function ($q) use ($request) {
                $needle = '%'.$request->string('q').'%';
                $q->where(fn ($w) => $w->where('display_name', 'like', $needle)->orWhere('phone', 'like', $needle));
            })
            ->orderByDesc('created_at')
            ->get();

        if ($request->boolean('holding')) {
            $customers = $customers->filter(
                fn ($c) => (float) ($c->credit_hours ?? 0) > 0 || (float) ($c->wallet?->balance ?? 0) > 0,
            )->values();
        }

        return response()->json([
            'data' => $customers->map(fn (Customer $c) => [
                'id' => (string) $c->id,
                'displayName' => $c->display_name,
                'phone' => $c->phone,
                // Two different things: `balance` is money, `creditHours` is
                // court time bought ahead. Never summed — a package is a
                // product sold at a discount, not a baht amount.
                'balance' => (float) ($c->wallet?->balance ?? 0),
                'creditHours' => (float) ($c->credit_hours ?? 0),
                'packages' => $c->packages->map(fn ($p) => [
                    'id' => (string) $p->id,
                    'name' => $p->name,
                    'totalHours' => (float) $p->total_hours,
                    'remainingHours' => (float) $p->remaining_hours,
                    'expiresAt' => $p->expires_at?->toDateString(),
                ])->values(),
            ])->values(),
        ]);
    }

    /**
     * GET /owner/customer-credit/{customerId}/history — every movement, newest
     * first, with the staff member who caused it.
     *
     * The point of an audit trail is that it answers "who gave this customer
     * ฿5,000" — a balance alone cannot, and neither can a ledger that records
     * only amounts.
     */
    public function history(Request $request, string $customerId): JsonResponse
    {
        $customer = $this->find($request, $customerId);

        $wallet = $customer->wallet;

        if (! $wallet) {
            return response()->json(['data' => []]);
        }

        $rows = \App\Models\WalletTransaction::query()
            ->where('wallet_id', $wallet->id)
            ->with('actor')
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();

        return response()->json([
            'data' => $rows->map(fn ($t) => [
                'id' => (string) $t->id,
                'label' => $t->label,
                'amount' => (float) $t->amount,
                'status' => $t->status,
                'source' => $t->source,
                // Null means the customer did it themselves — a top-up they
                // paid for is not an action anyone has to answer for.
                'byName' => $t->actor?->display_name ?? $t->actor?->name,
                'createdAt' => $t->created_at?->toIso8601String(),
            ])->values(),
        ]);
    }

    /**
     * POST /owner/customer-credit/{customerId}/hours — grant court-time credit.
     *
     * A grant is its own package rather than an edit to an existing one, so the
     * history reads as "sold 10 hours, then gave 2 as an apology" instead of a
     * number that silently changed.
     */
    public function grantHours(Request $request, string $customerId): JsonResponse
    {
        $customer = $this->find($request, $customerId);

        $data = $request->validate([
            'hours' => ['required', 'numeric', 'min:0.5', 'max:1000'],
            'name' => ['nullable', 'string', 'max:255'],
            'expiresAt' => ['nullable', 'date_format:Y-m-d', 'after:today'],
        ]);

        $package = CustomerPackage::create([
            'organization_id' => $customer->organization_id,
            'customer_id' => $customer->id,
            'name' => ($data['name'] ?? null) ?: 'เครดิตจากสนาม',
            'total_hours' => $data['hours'],
            'remaining_hours' => $data['hours'],
            'price' => 0, // granted, not sold — revenue reports must not count it
            'status' => 'active',
            'expires_at' => $data['expiresAt'] ?? null,
        ]);

        return response()->json(['data' => [
            'id' => (string) $package->id,
            'name' => $package->name,
            'remainingHours' => (float) $package->remaining_hours,
        ]], 201);
    }

    /**
     * POST /owner/customer-credit/{customerId}/hours/deduct — take hours back.
     *
     * For the mistake, not the refund: staff granting 100 instead of 10 need a
     * way back. Deducts across packages oldest-expiry first, the same order a
     * customer would spend them.
     */
    public function deductHours(Request $request, string $customerId): JsonResponse
    {
        $customer = $this->find($request, $customerId);

        $data = $request->validate([
            'hours' => ['required', 'numeric', 'min:0.5', 'max:1000'],
        ]);

        $packages = CustomerPackage::query()
            ->where('customer_id', $customer->id)
            ->where('status', 'active')
            ->where('remaining_hours', '>', 0)
            ->orderByRaw('expires_at is null, expires_at')
            ->get();

        $available = (float) $packages->sum('remaining_hours');
        $wanted = (float) $data['hours'];

        if ($wanted > $available + 0.001) {
            throw ValidationException::withMessages([
                'hours' => "ลูกค้ามีเครดิตเหลือ {$available} ชม. หักมากกว่านี้ไม่ได้",
            ]);
        }

        $left = $wanted;
        foreach ($packages as $package) {
            if ($left <= 0) {
                break;
            }

            $take = min($left, (float) $package->remaining_hours);
            $package->update(['remaining_hours' => round((float) $package->remaining_hours - $take, 2)]);
            $left = round($left - $take, 2);
        }

        return response()->json(['data' => [
            'creditHours' => round($available - $wanted, 2),
        ]]);
    }

    /** POST /owner/customer-credit/{customerId}/adjust — put baht in, or take it out. */
    public function adjustCredit(Request $request, string $customerId): JsonResponse
    {
        $customer = $this->find($request, $customerId);

        $data = $request->validate([
            // Signed: one control for both directions, because "adjust" is the
            // action staff are actually performing.
            'amount' => ['required', 'numeric', 'not_in:0', 'min:-1000000', 'max:1000000'],
            'label' => ['nullable', 'string', 'max:255'],
        ]);

        $amount = (float) $data['amount'];
        $label = ($data['label'] ?? null) ?: ($amount > 0 ? 'เติมเครดิตโดยสนาม' : 'ปรับยอดโดยสนาม');

        $actor = $request->user()?->id;

        $wallet = $amount > 0
            ? $this->credit->add($customer, $amount, $label, 'adjustment', $actor)
            : $this->credit->spend($customer, abs($amount), $label, null, 'adjustment', $actor);

        return response()->json(['data' => ['balance' => (float) $wallet->balance]]);
    }

    private function find(Request $request, string $id): Customer
    {
        return Customer::query()
            ->forOrganization($request->attributes->get('currentOrganizationId'))
            ->where('id', $id)
            ->firstOrFail();
    }
}
