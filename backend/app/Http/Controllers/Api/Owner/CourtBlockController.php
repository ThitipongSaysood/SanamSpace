<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Court;
use App\Models\CourtBlock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CourtBlockController extends Controller
{
    /** GET /owner/court-blocks?courtId=... — upcoming blocks (org-scoped). */
    public function index(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $blocks = CourtBlock::query()
            ->forOrganization($orgId)
            ->when($request->filled('courtId'), fn ($q) => $q->where('court_id', $request->query('courtId')))
            ->with('court')
            ->orderBy('date')
            ->orderBy('start')
            ->get()
            ->map(fn ($b) => [
                'id' => (string) $b->id,
                'courtId' => (string) $b->court_id,
                'courtName' => $b->court?->name,
                'date' => $b->date->toDateString(),
                'start' => $b->start,
                'end' => $b->end,
                'reason' => $b->reason,
            ]);

        return response()->json(['data' => $blocks]);
    }

    /** POST /owner/court-blocks — block a court (whole day if no start/end). */
    public function store(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $data = $request->validate([
            'courtId' => ['required', 'string', Rule::exists('courts', 'id')->where('organization_id', $orgId)],
            'date' => ['required', 'date_format:Y-m-d'],
            'start' => ['nullable', 'date_format:H:i'],
            'end' => ['nullable', 'date_format:H:i', 'after:start'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $court = Court::query()->forOrganization($orgId)->findOrFail($data['courtId']);

        $block = CourtBlock::create([
            'organization_id' => $orgId,
            'court_id' => $court->id,
            'date' => $data['date'],
            'start' => $data['start'] ?? null,
            'end' => $data['end'] ?? null,
            'reason' => $data['reason'] ?? null,
        ]);

        return response()->json(['id' => (string) $block->id], 201);
    }

    /** DELETE /owner/court-blocks/{id}. */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        CourtBlock::query()->forOrganization($orgId)->where('id', $id)->firstOrFail()->delete();

        return response()->json(null, 204);
    }
}
