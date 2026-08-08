<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The customer's own marketing consent (PDPA).
 *
 * Always acts on the authenticated customer — there is no id in any of these
 * routes, so one customer cannot change another's consent even by guessing.
 *
 * The venue's staff deliberately cannot set these on a customer's behalf:
 * consent someone else ticked for you is not consent.
 */
class ConsentController extends Controller
{
    /** GET /me/consent */
    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->state($request->user())]);
    }

    /**
     * POST /me/consent — { granted: bool }
     *
     * Granting also lifts an earlier opt-out: someone who says yes now should
     * not stay suppressed by a no from last year.
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'granted' => ['required', 'boolean'],
        ]);

        /** @var Customer $customer */
        $customer = $request->user();

        $customer->update([
            'marketing_consent' => $validated['granted'],
            'consent_at' => now(),
            // Saying no here is an opt-out too — otherwise the toggle would
            // read "off" while broadcasts kept arriving.
            'unsubscribed_at' => $validated['granted'] ? null : ($customer->unsubscribed_at ?? now()),
        ]);

        return response()->json(['data' => $this->state($customer->fresh())]);
    }

    /**
     * POST /me/unsubscribe — the one-tap opt-out.
     *
     * Separate from `consent` because this is what an unsubscribe link does,
     * and it must work without asking any further questions. Idempotent: the
     * original opt-out time is kept, since "when did they opt out" is the
     * question a compliance request asks.
     */
    public function unsubscribe(Request $request): JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user();

        if (! $customer->isUnsubscribed()) {
            $customer->update(['unsubscribed_at' => now()]);
        }

        return response()->json(['data' => $this->state($customer->fresh())]);
    }

    /** POST /me/resubscribe — opting back in, without pretending consent was never withdrawn. */
    public function resubscribe(Request $request): JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user();

        $customer->update([
            'unsubscribed_at' => null,
            'marketing_consent' => true,
            'consent_at' => now(),
        ]);

        return response()->json(['data' => $this->state($customer->fresh())]);
    }

    /**
     * `consent` is nullable on purpose: null means nobody ever asked, which is
     * a different thing from having said no.
     */
    private function state(Customer $customer): array
    {
        return [
            'consent' => $customer->marketing_consent,
            'consentAt' => $customer->consent_at?->toIso8601String(),
            'unsubscribedAt' => $customer->unsubscribed_at?->toIso8601String(),
            'marketingAllowed' => ! $customer->isUnsubscribed(),
        ];
    }
}
