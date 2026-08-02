<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\SubscriptionResource;
use App\Models\Subscription;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Platform oversight of every venue's plan.
 *
 * Ending a plan is two different decisions, so it is two different actions:
 *
 *  - **ยกเลิก (cancel)** stops the renewal and lets the paid period run out.
 *    The venue keeps working until `ends_at`, then locks itself out normally.
 *    This is the right answer for someone who has paid through the month.
 *  - **ระงับทันที (suspend)** ends it now. `EnsureSubscriptionActive` reads
 *    `ends_at`, so pulling that date to the present is what actually locks the
 *    owner portal — flipping the status alone would change nothing.
 *
 * Either way the venue's customers keep booking; only the owner portal locks.
 */
class SubscriptionController extends Controller
{
    /** GET /admin/subscriptions — ALL subscriptions across every organization. */
    public function index(): AnonymousResourceCollection
    {
        $subscriptions = Subscription::query()
            ->with(['organization', 'plan'])
            ->orderBy('created_at')
            ->get();

        return SubscriptionResource::collection($subscriptions);
    }

    /** POST /admin/subscriptions/{id}/cancel — stops at the end of the paid period. */
    public function cancel(Request $request, string $id): SubscriptionResource
    {
        $subscription = $this->find($id);
        $subscription->update(['status' => 'cancelled']);

        return $this->fresh($subscription);
    }

    /** POST /admin/subscriptions/{id}/suspend — ends it now. */
    public function suspend(Request $request, string $id): SubscriptionResource
    {
        $subscription = $this->find($id);
        $subscription->update(['status' => 'cancelled', 'ends_at' => now()]);

        return $this->fresh($subscription);
    }

    /**
     * POST /admin/subscriptions/{id}/resume — back to active.
     *
     * A plan suspended by mistake has `ends_at` in the past, so resuming it
     * alone would leave the venue locked out. The caller may hand over the new
     * end date; without one, a plan whose date has passed gets a month so the
     * venue can get back in and settle up.
     */
    public function resume(Request $request, string $id): SubscriptionResource
    {
        $subscription = $this->find($id);

        $validated = $request->validate([
            'endsAt' => ['sometimes', 'nullable', 'date'],
        ]);

        $endsAt = array_key_exists('endsAt', $validated) && $validated['endsAt']
            ? \Illuminate\Support\Carbon::parse($validated['endsAt'])
            : ($subscription->ends_at && $subscription->ends_at->isFuture()
                ? $subscription->ends_at
                : now()->addMonth());

        $subscription->update(['status' => 'active', 'ends_at' => $endsAt]);

        return $this->fresh($subscription);
    }

    private function find(string $id): Subscription
    {
        return Subscription::query()->findOrFail($id);
    }

    private function fresh(Subscription $subscription): SubscriptionResource
    {
        return new SubscriptionResource($subscription->fresh(['organization', 'plan']));
    }
}
