<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesOrganization;
use App\Http\Controllers\Controller;
use App\Http\Resources\CourtResource;
use App\Http\Resources\CourtScheduleResource;
use App\Models\Court;
use App\Services\CourtScheduleService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CourtController extends Controller
{
    use ResolvesOrganization;

    /**
     * GET /courts?venueId={slug|branchId} -> Court[]
     * Also serves GET /branches/{id}/courts (id passed as route param).
     *
     * Always scoped to the current venue — an unscoped listing would expose
     * every court on the platform.
     */
    public function index(Request $request, ?string $id = null): AnonymousResourceCollection
    {
        $venueId = $id ?? $request->query('venueId');
        $org = $this->resolveOrganizationOrFail($request, $venueId);

        $query = Court::query()
            ->with('branch.organization')
            ->forOrganization($org->id)
            ->orderBy('sort_order')
            ->orderBy('created_at');

        // A branch UUID narrows further; an org slug is already covered above.
        if ($venueId) {
            $query->whereHas('branch', function ($q) use ($venueId) {
                $q->where('id', $venueId)
                    ->orWhereHas('organization', fn ($oq) => $oq->where('slug', $venueId));
            });
        }

        return CourtResource::collection($query->get());
    }

    /**
     * GET /courts/{id} -> Court
     *
     * Scoped: knowing another venue's court UUID must not be enough to read it.
     */
    public function show(Request $request, string $id): CourtResource
    {
        $court = Court::with('branch.organization')->findOrFail($id);
        $this->assertBelongsToCurrentVenue($request, $court);

        return new CourtResource($court);
    }

    /**
     * GET /courts/{id}/schedules?date=YYYY-MM-DD -> CourtSchedule
     */
    public function schedules(Request $request, string $id, CourtScheduleService $service): CourtScheduleResource
    {
        $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $court = Court::findOrFail($id);
        $this->assertBelongsToCurrentVenue($request, $court);

        $date = $request->query('date', now()->toDateString());

        return new CourtScheduleResource($service->generate($court, $date));
    }

    /**
     * 404 (not 403) when the court belongs to a different venue — a venue's
     * courts should not even be discoverable from another venue's app.
     */
    private function assertBelongsToCurrentVenue(Request $request, Court $court): void
    {
        $org = $this->resolveOrganization($request);

        abort_if($org === null || $court->organization_id !== $org->id, 404);
    }
}
