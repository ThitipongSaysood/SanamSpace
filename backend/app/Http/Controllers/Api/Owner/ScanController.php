<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\RewardRedemption;
use App\Services\CheckinService;
use App\Services\PointsService;
use App\Support\StaffPermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * One scanner for the counter.
 *
 * Staff had to know which menu to open before they knew what they were holding:
 * a booking QR meant Check-in, a reward code meant Points. That is backwards —
 * the customer holds up a phone and the desk should just scan it.
 *
 * The codes were already distinguishable, so nothing new had to be encoded:
 * a check-in token is a booking's own opaque token (or its BK… code), and a
 * collection code is six characters starting with R. This routes on that.
 *
 * Permissions are checked per branch rather than on the route. A cashier who
 * may check people in but may not hand out rewards must not gain that power by
 * scanning instead of clicking — one door with two locks, not a skeleton key.
 */
class ScanController extends Controller
{
    public function __construct(
        private CheckinService $checkins,
        private PointsService $points,
    ) {}

    /**
     * POST /owner/scan — { code } from the camera, or typed by hand.
     *
     * Always says what it decided (`kind`), because "it worked" is not enough
     * information at a counter: the person needs to know whether they are
     * letting someone onto a court or handing over a bottle of water.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:64'],
        ]);

        $code = trim($validated['code']);
        $orgId = $request->attributes->get('currentOrganizationId');

        // Rewards first: a collection code is short and unmistakable, while a
        // check-in token is looked up by two different columns and would be the
        // wider net.
        $redemption = RewardRedemption::query()
            ->forOrganization($orgId)
            ->whereRaw('UPPER(code) = ?', [mb_strtoupper($code)])
            ->with('customer')
            ->first();

        if ($redemption) {
            return $this->collectReward($request, $redemption);
        }

        $org = Organization::findOrFail($orgId);
        $booking = $this->checkins->find($org, $code);

        if ($booking) {
            return $this->checkIn($request, $booking);
        }

        // Neither. Said plainly, because the desk's next move is to ask the
        // customer rather than to scan the same thing harder.
        return response()->json([
            'kind' => 'unknown',
            'ok' => false,
            'code' => 'not_found',
            'message' => 'ไม่รู้จักรหัสนี้ — ไม่ใช่ทั้ง QR เช็คอินและรหัสรับของ',
        ], 404);
    }

    private function collectReward(Request $request, RewardRedemption $redemption): JsonResponse
    {
        if (! $this->allows($request, 'crm.manage')) {
            return $this->forbidden('reward', 'บัญชีนี้ไม่มีสิทธิ์จ่ายของรางวัล');
        }

        // Already handed over, or expired: a refusal the desk can act on, not a
        // 422 that reads as a broken scanner.
        if ($redemption->status !== 'pending') {
            return response()->json([
                'kind' => 'reward',
                'ok' => false,
                'code' => $redemption->status === 'collected' ? 'already_collected' : 'expired',
                'message' => $redemption->status === 'collected'
                    ? 'รหัสนี้รับของไปแล้ว'
                    : 'รหัสนี้เลยเวลารับ · คืนคะแนนให้ลูกค้าแล้ว',
                'reward' => $this->rewardSummary($redemption),
            ]);
        }

        $this->points->collect($redemption, $request->user()?->id);

        return response()->json([
            'kind' => 'reward',
            'ok' => true,
            'code' => 'collected',
            'message' => 'จ่ายของรางวัลเรียบร้อย',
            'reward' => $this->rewardSummary($redemption->fresh('customer')),
        ]);
    }

    private function checkIn(Request $request, \App\Models\Booking $booking): JsonResponse
    {
        if (! $this->allows($request, 'booking.checkin')) {
            return $this->forbidden('checkin', 'บัญชีนี้ไม่มีสิทธิ์เช็คอิน');
        }

        $result = $this->checkins->attempt($booking);

        return response()->json([
            'kind' => 'checkin',
            'ok' => $result['ok'],
            'code' => $result['code'],
            'message' => $result['message'],
            'booking' => $this->checkins->summary($result['booking']),
        ]);
    }

    private function allows(Request $request, string $permission): bool
    {
        return StaffPermissions::allows($request, $permission);
    }

    private function forbidden(string $kind, string $message): JsonResponse
    {
        return response()->json([
            'kind' => $kind,
            'ok' => false,
            'code' => 'forbidden',
            'message' => $message,
        ], 403);
    }

    private function rewardSummary(RewardRedemption $r): array
    {
        return [
            'id' => (string) $r->id,
            'name' => $r->name,
            'pointsSpent' => (int) $r->points_spent,
            'customerName' => $r->customer?->display_name,
        ];
    }
}
