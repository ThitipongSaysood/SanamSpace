<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CourtResource;
use App\Http\Resources\CourtScheduleResource;
use App\Models\Court;
use App\Services\CourtScheduleService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CourtController extends Controller
{
    /**
     * GET /courts?venueId={slug|branchId} -> Court[]
     * Also serves GET /branches/{id}/courts (id passed as route param).
     */
    public function index(Request $request, ?string $id = null): AnonymousResourceCollection
    {
        $query = Court::query()
            ->with('branch.organization')
            ->orderBy('sort_order')
            ->orderBy('created_at');

        if ($venueId = ($id ?? $request->query('venueId'))) {
            $query->whereHas('branch', function ($q) use ($venueId) {
                $q->where('id', $venueId)
                    ->orWhereHas('organization', fn ($oq) => $oq->where('slug', $venueId));
            });
        }

        return CourtResource::collection($query->get());
    }

    /**
     * GET /courts/{id} -> Court
     */
    public function show(string $id): CourtResource
    {
        $court = Court::with('branch.organization')->findOrFail($id);

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
        $date = $request->query('date', now()->toDateString());

        return new CourtScheduleResource($service->generate($court, $date));
    }
}
