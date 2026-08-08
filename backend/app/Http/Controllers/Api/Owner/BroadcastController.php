<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerBroadcastResource;
use App\Models\Broadcast;
use App\Models\BroadcastRecipient;
use App\Models\Customer;
use App\Models\CustomerSegment;
use App\Models\OrganizationSetting;
use App\Services\LineMessagingService;
use App\Services\NotificationService;
use App\Services\SegmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class BroadcastController extends Controller
{
    /** Audience presets a broadcast can target (besides a saved segment). */
    private const AUDIENCES = ['all', 'lost', 'new', 'one_time', 'regulars', 'segment'];

    /** Delivery channels: `line` pushes over LINE, `app` shows in the customer app. */
    private const CHANNELS = ['line', 'app', 'email', 'sms', 'push'];

    public function __construct(
        private LineMessagingService $line,
        private NotificationService $notifications,
        private SegmentService $segments,
    ) {}

    /**
     * GET /owner/broadcasts — org broadcasts, newest first.
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
     * GET /owner/broadcasts/audience-preview — how many customers an audience
     * reaches, and how many of them are actually contactable over LINE, before
     * the owner commits to sending. { recipientCount, reachableCount }.
     */
    public function audiencePreview(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $validated = $request->validate($this->audienceRules($request));

        $recipients = $this->resolveAudience(
            $orgId,
            $validated['audience'] ?? 'all',
            $validated['inactiveDays'] ?? null,
            $validated['segmentId'] ?? null,
        );

        return response()->json([
            'recipientCount' => $recipients->count(),
            'reachableCount' => $this->line->reachableCount($recipients),
            // Said out loud rather than left as an unexplained shortfall: the
            // owner should know the audience is smaller because people opted
            // out, not wonder whether the filter is broken.
            'suppressedCount' => Customer::query()
                ->forOrganization($orgId)
                ->whereNotNull('unsubscribed_at')
                ->count(),
        ]);
    }

    /**
     * POST /owner/broadcasts — create a draft broadcast in the current org.
     */
    public function store(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $validated = $request->validate(array_merge([
            'title' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string'],
            'imageUrl' => ['nullable', 'string', 'url', 'max:2048'],
            'channel' => ['required', 'string', Rule::in(self::CHANNELS)],
        ], $this->audienceRules($request)));

        // Back-compat: the older CRM form sends `segmentId` with no `audience`.
        // Treat a bare segmentId as a segment broadcast.
        $audience = $validated['audience'] ?? (! empty($validated['segmentId']) ? 'segment' : 'all');
        $segmentId = $audience === 'segment' ? ($validated['segmentId'] ?? null) : null;

        if ($segmentId) {
            // Reject a segment that isn't in this org.
            CustomerSegment::query()
                ->forOrganization($orgId)
                ->where('id', $segmentId)
                ->firstOr(fn () => abort(422, 'Segment does not belong to this organization.'));
        }

        $broadcast = Broadcast::create([
            'organization_id' => $orgId,
            'title' => $validated['title'],
            'message' => $validated['message'],
            'image_url' => $validated['imageUrl'] ?? null,
            'channel' => $validated['channel'],
            'audience' => $audience,
            'inactive_days' => $validated['inactiveDays'] ?? null,
            'segment_id' => $segmentId,
            'status' => 'draft',
            'recipient_count' => 0,
        ]);

        return (new OwnerBroadcastResource($broadcast->load('segment')))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * POST /owner/broadcasts/{id}/send — resolve the audience, push it over LINE
     * (when the channel is line), and record the result. 404 cross-org.
     *
     * The response's `delivery` block reports what actually happened: how many
     * messages were sent, how many recipients had no LINE profile (skipped), and
     * whether the venue simply hasn't configured a messaging token yet.
     */
    public function send(Request $request, string $id): OwnerBroadcastResource
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $broadcast = Broadcast::query()
            ->forOrganization($orgId)
            ->where('id', $id)
            ->firstOrFail();

        $recipients = $this->resolveAudience(
            $orgId,
            $broadcast->audience ?? 'all',
            $broadcast->inactive_days,
            $broadcast->segment_id,
        );

        $delivery = [
            'sent' => 0,
            'failed' => 0,
            'skipped' => $recipients->count(),
            'noToken' => false,
            'results' => [],
        ];

        if ($broadcast->channel === 'line') {
            $settings = OrganizationSetting::query()->where('organization_id', $orgId)->first();
            $delivery = $this->line->pushText($settings, $recipients, $broadcast->message, $broadcast->image_url);
        } elseif ($broadcast->channel === 'app') {
            // "แสดงในแอป" — drop a promo into each targeted customer's bell. Every
            // targeted customer is reachable in-app (no LINE profile needed).
            $results = [];
            foreach ($recipients as $customer) {
                $this->notifications->promo($orgId, $customer->id, $broadcast->title, $broadcast->message, $broadcast->image_url);
                $results[$customer->id] = ['status' => 'sent', 'reason' => null];
            }
            $delivery = [
                'sent' => $recipients->count(),
                'failed' => 0,
                'skipped' => 0,
                'noToken' => false,
                'results' => $results,
            ];
        }

        $sentAt = now();

        // One row per person. This is what makes "have we already messaged
        // them" and later per-customer attribution answerable — a count cannot.
        $rows = [];
        foreach ($delivery['results'] ?? [] as $customerId => $outcome) {
            $rows[] = [
                'id' => (string) Str::uuid(),
                'broadcast_id' => $broadcast->id,
                'customer_id' => $customerId,
                'status' => $outcome['status'],
                'reason' => $outcome['reason'],
                'sent_at' => $outcome['status'] === 'sent' ? $sentAt : null,
                'created_at' => $sentAt,
                'updated_at' => $sentAt,
            ];
        }

        if ($rows !== []) {
            foreach (array_chunk($rows, 500) as $chunk) {
                BroadcastRecipient::insert($chunk);
            }
        }

        $broadcast->update([
            'status' => 'sent',
            'sent_at' => $sentAt,
            'sent_by' => $request->user()?->id,
            'recipient_count' => $recipients->count(),
            // The summary, kept. It used to be shown once and thrown away, so
            // reopening a broadcast could not say whether it had gone out.
            'delivery_stats' => collect($delivery)->except('results')->all(),
        ]);

        $fresh = $broadcast->fresh()->load('segment');
        $fresh->setAttribute('delivery', collect($delivery)->except('results')->all());

        return new OwnerBroadcastResource($fresh);
    }

    /**
     * PUT /owner/broadcasts/{id} — edit a DRAFT broadcast. A sent broadcast is a
     * historical record and can't be changed (422). Org-scoped (404 cross-org).
     */
    public function update(Request $request, string $id): OwnerBroadcastResource
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $broadcast = Broadcast::query()
            ->forOrganization($orgId)
            ->where('id', $id)
            ->firstOrFail();

        if ($broadcast->status !== 'draft') {
            abort(422, 'บรอดแคสต์ที่ส่งไปแล้วแก้ไขไม่ได้');
        }

        $validated = $request->validate(array_merge([
            'title' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string'],
            'imageUrl' => ['nullable', 'string', 'url', 'max:2048'],
            'channel' => ['required', 'string', Rule::in(self::CHANNELS)],
        ], $this->audienceRules($request)));

        $audience = $validated['audience'] ?? (! empty($validated['segmentId']) ? 'segment' : 'all');
        $segmentId = $audience === 'segment' ? ($validated['segmentId'] ?? null) : null;

        if ($segmentId) {
            CustomerSegment::query()
                ->forOrganization($orgId)
                ->where('id', $segmentId)
                ->firstOr(fn () => abort(422, 'Segment does not belong to this organization.'));
        }

        $broadcast->update([
            'title' => $validated['title'],
            'message' => $validated['message'],
            'image_url' => $validated['imageUrl'] ?? null,
            'channel' => $validated['channel'],
            'audience' => $audience,
            'inactive_days' => $validated['inactiveDays'] ?? null,
            'segment_id' => $segmentId,
        ]);

        return new OwnerBroadcastResource($broadcast->fresh()->load('segment'));
    }

    /** DELETE /owner/broadcasts/{id} — remove a broadcast (soft delete). Org-scoped. */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $broadcast = Broadcast::query()
            ->forOrganization($orgId)
            ->where('id', $id)
            ->firstOrFail();

        $broadcast->delete();

        return response()->json(['id' => (string) $id, 'deleted' => true]);
    }

    /** Validation rules shared by preview + store for the audience fields. */
    private function audienceRules(Request $request): array
    {
        $audience = $request->input('audience', 'all');

        return [
            'audience' => ['nullable', Rule::in(self::AUDIENCES)],
            // lost / new need a day window; the others ignore it.
            'inactiveDays' => [Rule::requiredIf(in_array($audience, ['lost', 'new'], true)), 'nullable', 'integer', 'min:1', 'max:3650'],
            'segmentId' => [Rule::requiredIf($audience === 'segment'), 'nullable', 'string'],
        ];
    }

    /**
     * Resolve an audience to the set of customers it targets, each with its
     * LINE profiles loaded so delivery can read the user ids.
     *
     * @return Collection<int,Customer>
     */
    private function resolveAudience(string $orgId, string $audience, ?int $days, ?string $segmentId): Collection
    {
        if ($audience === 'segment') {
            $segment = CustomerSegment::query()
                ->forOrganization($orgId)
                ->find($segmentId);

            // Hand-picked or criteria-driven — the service knows which, and
            // suppression is applied either way. A segment is exactly the place
            // an opt-out would otherwise be missed.
            return $segment ? $this->segments->membersOf($segment) : collect();
        }

        // Suppression applies to every audience, before any of them narrows
        // further. Putting it here rather than in each branch is what stops the
        // next audience anyone adds from quietly skipping it.
        $query = Customer::query()->forOrganization($orgId)->marketingReachable()->with('lineProfiles');
        $active = fn ($q) => $q->where('status', '!=', 'cancelled');

        switch ($audience) {
            case 'lost':
                // Booked before, but nothing recent — they stopped coming.
                $cutoff = now()->subDays($days ?? config('broadcast.lost_inactive_days'))->toDateString();
                $query->whereHas('bookings', $active)
                    ->whereDoesntHave('bookings', fn ($q) => $active($q)->where('date', '>=', $cutoff));
                break;

            case 'new':
                $query->where('created_at', '>=', now()->subDays($days ?? config('broadcast.new_within_days')));
                break;

            case 'one_time':
                $query->whereHas('bookings', $active, '=', 1);
                break;

            case 'regulars':
                $query->whereHas('bookings', $active, '>=', (int) config('broadcast.regular_min_bookings'));
                break;

            case 'all':
            default:
                break;
        }

        return $query->get();
    }
}
