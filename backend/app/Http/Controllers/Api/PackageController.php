<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesOrganization;
use App\Http\Controllers\Controller;
use App\Http\Resources\CustomerPackageResource;
use App\Http\Resources\VenuePackageResource;
use App\Models\CustomerPackage;
use App\Models\OrganizationSetting;
use App\Models\VenuePackage;
use App\Services\PromptPayService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;

class PackageController extends Controller
{
    use ResolvesOrganization;

    /**
     * GET /packages -> VenuePackage[]
     *
     * Strictly the current venue's packages (X-Venue-Slug / ?venueId / the
     * signed-in customer's org). No tenant → 404, never another venue's list.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $org = $this->resolveOrganizationOrFail($request, $request->query('venueId'));

        $packages = VenuePackage::query()
            ->forOrganization($org->id)
            ->orderBy('sort_order')
            ->orderBy('created_at')
            ->get();

        return VenuePackageResource::collection($packages);
    }

    /**
     * GET /my-packages -> CustomerPackage[] (the customer's purchased packages).
     */
    public function myPackages(Request $request): AnonymousResourceCollection
    {
        $packages = CustomerPackage::query()
            ->where('customer_id', $request->user()->id)
            ->whereIn('status', ['active', 'pending', 'pending_review'])
            ->orderByDesc('created_at')
            ->get();

        return CustomerPackageResource::collection($packages);
    }

    /**
     * POST /packages/{id}/purchase -> { purchaseId, amount, promptpay, bank }
     *
     * Creates a PENDING customer package and returns how to pay for it. The
     * package only becomes usable after the venue approves the slip.
     */
    public function purchase(Request $request, string $id, PromptPayService $promptpay): JsonResponse
    {
        $package = VenuePackage::query()->findOrFail($id);
        $customer = $request->user();

        // Tenant isolation: a customer may only buy a package from their own
        // venue. The package is fetched by id alone, so without this a venue A
        // customer could purchase venue B's package (creating a pending row in
        // venue B and leaking venue B's PromptPay / bank details in the reply).
        abort_if($package->organization_id !== $customer->organization_id, 404);

        $purchase = CustomerPackage::create([
            'organization_id' => $package->organization_id,
            'customer_id' => $customer->id,
            'venue_package_id' => $package->id,
            'name' => $package->name,
            'total_hours' => $package->hours,
            'remaining_hours' => $package->hours,
            'price' => $package->price,
            'valid_days' => $package->valid_days,
            'status' => 'pending',
        ]);

        $setting = OrganizationSetting::query()->where('organization_id', $package->organization_id)->first();
        $promptpayBlock = filled($setting?->promptpay_id)
            ? ['payload' => $promptpay->payload($setting->promptpay_id, (float) $package->price)]
            : null;
        $bankBlock = filled($setting?->bank_account_number)
            ? ['bankName' => $setting->bank_name, 'accountName' => $setting->bank_account_name, 'accountNumber' => $setting->bank_account_number]
            : null;

        return response()->json([
            'purchaseId' => (string) $purchase->id,
            'amount' => (float) $package->price,
            'promptpay' => $promptpayBlock,
            'bank' => $bankBlock,
        ]);
    }

    /**
     * POST /packages/purchases/{id}/slip — attach the transfer slip; moves the
     * purchase to pending_review for the venue to approve.
     */
    public function purchaseSlip(Request $request, string $id): CustomerPackageResource
    {
        $request->validate([
            'slip' => ['required', 'image', 'mimes:jpeg,jpg,png', 'max:5120'],
        ]);

        $purchase = CustomerPackage::query()
            ->where('id', $id)
            ->where('customer_id', $request->user()->id)
            ->firstOrFail();

        $path = $request->file('slip')->store('slips/'.$purchase->organization_id, 'public');

        $purchase->update([
            'slip_url' => url(Storage::url($path)),
            'status' => 'pending_review',
        ]);

        return new CustomerPackageResource($purchase->fresh());
    }
}
