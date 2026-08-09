<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\CustomerPackage;
use App\Models\VenuePackage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * The hour packages a venue sells.
 *
 * Packages are priced in HOURS on purpose, and that is not the same thing as
 * credit: credit is baht and pays for anything, a package is court time bought
 * ahead at a discount. A venue selling "10 ชม. ฿2,500" is selling time, and
 * converting that to money at purchase would quietly hand back the discount.
 *
 * Until now the catalogue existed only because the seeder wrote it — customers
 * could browse and buy, and the venue could not add, reprice or retire a single
 * one of them.
 */
class VenuePackageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $packages = VenuePackage::query()
            ->forOrganization($orgId)
            // How many customers actually hold each one — the number that says
            // whether retiring a package is a small decision or a big one.
            ->withCount(['customerPackages as active_holders' => fn ($q) => $q->where('status', 'active')])
            ->orderBy('sort_order')
            ->orderBy('hours')
            ->get();

        return response()->json(['data' => $packages->map(fn (VenuePackage $p) => $this->present($p))->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $data = $this->validated($request, creating: true);

        $package = VenuePackage::create([
            'organization_id' => $orgId,
            'name' => $data['name'],
            'hours' => $data['hours'],
            'price' => $data['price'],
            'valid_days' => $data['validDays'] ?? 0,
            'save_percent' => $this->savePercent($orgId, (float) $data['hours'], (float) $data['price']),
            'sort_order' => (int) VenuePackage::query()->forOrganization($orgId)->max('sort_order') + 1,
        ]);

        return response()->json(['data' => $this->present($package)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $package = $this->find($request, $id);
        $data = $this->validated($request);

        $map = ['name' => 'name', 'hours' => 'hours', 'price' => 'price', 'validDays' => 'valid_days'];

        $updates = [];
        foreach ($map as $field => $column) {
            if (array_key_exists($field, $data)) {
                $updates[$column] = $data[$field];
            }
        }

        if ($updates) {
            $package->update($updates);
            $package->update([
                'save_percent' => $this->savePercent($orgId, (float) $package->hours, (float) $package->price),
            ]);
        }

        // Repricing changes what the NEXT customer pays. Packages already sold
        // are snapshots on `customer_packages` and keep their own hours — the
        // same reason rental lines and discounts are snapshotted.
        return response()->json(['data' => $this->present($package->fresh())]);
    }

    /**
     * DELETE /owner/packages/{id} — stop selling it.
     *
     * Soft delete: customers who bought it keep their hours, and a package that
     * vanished from the database would take their purchase history with it.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $package = $this->find($request, $id);

        $package->delete();

        return response()->json(null, 204);
    }

    private function present(VenuePackage $p): array
    {
        return [
            'id' => (string) $p->id,
            'name' => $p->name,
            'hours' => (float) $p->hours,
            'price' => (float) $p->price,
            'validDays' => (int) $p->valid_days,
            'savePercent' => (int) $p->save_percent,
            'activeHolders' => (int) ($p->active_holders ?? 0),
            // Only meaningful next to the venue's own court price, so it is
            // computed rather than typed — a "ประหยัด 20%" nobody checked
            // against the real rate is a claim, not a fact.
            'pricePerHour' => $p->hours > 0 ? round((float) $p->price / (float) $p->hours, 2) : 0.0,
        ];
    }

    /**
     * How much cheaper an hour is inside this package than off the shelf.
     *
     * Measured against the venue's own cheapest court, so it cannot advertise a
     * saving the venue does not actually offer.
     */
    private function savePercent(string $orgId, float $hours, float $price): int
    {
        if ($hours <= 0 || $price <= 0) {
            return 0;
        }

        $rate = (float) \App\Models\Court::query()
            ->forOrganization($orgId)
            ->where('status', 'active')
            ->min('price_per_hour');

        if ($rate <= 0) {
            return 0;
        }

        $normal = $rate * $hours;

        return $normal > $price ? (int) round((1 - $price / $normal) * 100) : 0;
    }

    private function validated(Request $request, bool $creating = false): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'name' => [$required, 'string', 'max:255'],
            'hours' => [$required, 'numeric', 'min:1', 'max:1000'],
            'price' => [$required, 'numeric', 'min:1', 'max:1000000'],
            // 0 = never expires. Venues that want a deadline set one.
            'validDays' => ['sometimes', 'integer', 'min:0', 'max:3650'],
        ]);
    }

    private function find(Request $request, string $id): VenuePackage
    {
        return VenuePackage::query()
            ->forOrganization($request->attributes->get('currentOrganizationId'))
            ->where('id', $id)
            ->firstOrFail();
    }
}
