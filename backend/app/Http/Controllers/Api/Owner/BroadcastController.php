<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerBroadcastResource;
use App\Models\Broadcast;
use App\Models\Customer;
use App\Models\CustomerSegment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class BroadcastController extends Controller
{
    /**
     * GET /owner/broadcasts — org broadcasts, newest first.
     * Each item: { id, title, message, channel, status, recipientCount, sentAt, segmentName }
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $broadcasts = Broadcast::query()
            ->forOrganization($orgId)
            ->with('segment')
            ->orderByDesc('created_at')
            ->get();

        return OwnerBroadcastResource::collection($broadcasts);
    }

    /**
     * POST /owner/broadcasts — create a draft broadcast in the current org.
     * segmentId (when given) must belong to this org (422 otherwise).
     */
    public function store(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string'],
            'channel' => ['required', 'string', 'in:line,email,sms,push'],
            'segmentId' => ['nullable', 'string'],
        ]);

        if (! empty($validated['segmentId'])) {
            // Reject a segment that isn't in this org.
            CustomerSegment::query()
                ->forOrganization($orgId)
                ->where('id', $validated['segmentId'])
                ->firstOr(function () {
                    abort(422, 'Segment does not belong to this organization.');
                });
        }

        $broadcast = Broadcast::create([
            'organization_id' => $orgId,
            'title' => $validated['title'],
            'message' => $validated['message'],
            'channel' => $validated['channel'],
            'segment_id' => $validated['segmentId'] ?? null,
            'status' => 'draft',
            'recipient_count' => 0,
        ]);

        return (new OwnerBroadcastResource($broadcast->load('segment')))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * POST /owner/broadcasts/{id}/send — mark an org-scoped broadcast as sent.
     * recipient_count = segment member count (if it targets a segment), else the
     * org's total customer count. 404 cross-org.
     */
    public function send(Request $request, string $id): OwnerBroadcastResource
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $broadcast = Broadcast::query()
            ->forOrganization($orgId)
            ->where('id', $id)
            ->firstOrFail();

        if ($broadcast->segment_id) {
            $recipientCount = CustomerSegment::query()
                ->forOrganization($orgId)
                ->where('id', $broadcast->segment_id)
                ->withCount('members')
                ->value('members_count') ?? 0;
        } else {
            $recipientCount = Customer::query()
                ->forOrganization($orgId)
                ->count();
        }

        $broadcast->update([
            'status' => 'sent',
            'sent_at' => now(),
            'recipient_count' => (int) $recipientCount,
        ]);

        return new OwnerBroadcastResource($broadcast->fresh()->load('segment'));
    }
}
