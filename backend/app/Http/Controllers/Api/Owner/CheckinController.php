<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Services\CheckinService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The counter's side of check-in: staff scan, the customer shows.
 *
 * Deliberately not a customer-facing action. The old flow had a button on the
 * customer's own screen that marked their booking complete, which is not a
 * check-in — it is a customer marking their own attendance.
 */
class CheckinController extends Controller
{
    public function __construct(private CheckinService $checkins) {}

    /**
     * POST /owner/checkin — { token } from the QR, or a typed booking code.
     *
     * Always 200 with an `ok` flag: a refusal is information for the person at
     * the desk, not an error condition. Only a code that belongs to no booking
     * here is a 404.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:64'],
        ]);

        $org = Organization::findOrFail($request->attributes->get('currentOrganizationId'));
        $booking = $this->checkins->find($org, $validated['token']);

        if (! $booking) {
            return response()->json([
                'ok' => false,
                'code' => 'not_found',
                'message' => 'ไม่พบการจองนี้ในสนามของคุณ',
                'booking' => null,
            ], 404);
        }

        $result = $this->checkins->attempt($booking);

        return response()->json([
            'ok' => $result['ok'],
            'code' => $result['code'],
            'message' => $result['message'],
            'booking' => $this->checkins->summary($result['booking']),
        ]);
    }

    /**
     * GET /owner/checkin/recent — who has arrived, newest first.
     *
     * Gives the desk a way to confirm a scan landed without re-scanning, and to
     * see the shift at a glance.
     */
    public function recent(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $bookings = \App\Models\Booking::query()
            ->with(['court', 'customer'])
            ->where('organization_id', $orgId)
            ->whereNotNull('checked_in_at')
            ->orderByDesc('checked_in_at')
            ->limit(20)
            ->get();

        return response()->json([
            'data' => $bookings->map(fn ($b) => $this->checkins->summary($b))->values(),
        ]);
    }
}
