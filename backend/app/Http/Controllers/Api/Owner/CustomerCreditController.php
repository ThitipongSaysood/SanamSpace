<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerPackage;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * What a customer holds with the venue, and how staff change it.
 *
 * Two currencies that are deliberately not one:
 *   - credit  = hours of court time, sold as packages
 *   - wallet  = baht, which can pay for anything
 *
 * They are shown side by side and adjusted separately, because converting hours
 * to money needs a rate nobody has agreed on — and a venue that sells "10 hours
 * for ฿2,000" has not promised that an hour is worth ฿200 forever.
 */
class CustomerCreditController extends Controller
{
    public function __construct(private WalletService $wallets) {}

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
                'creditHours' => (float) ($c->credit_hours ?? 0),
                'walletBalance' => (float) ($c->wallet?->balance ?? 0),
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

    /** POST /owner/customer-credit/{customerId}/wallet — put baht in, or take it out. */
    public function adjustWallet(Request $request, string $customerId): JsonResponse
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

        $wallet = $amount > 0
            ? $this->wallets->credit($customer, $amount, $label)
            : $this->wallets->spend($customer, abs($amount), $label);

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
