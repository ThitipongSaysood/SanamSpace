<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\MembershipResource;
use App\Models\Membership;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MembershipController extends Controller
{
    /**
     * GET /membership -> Membership (current authenticated customer).
     *
     * Every customer should always have a membership, so a fresh customer (e.g.
     * just registered via LINE) gets a default Silver one created on first read
     * instead of a 404.
     */
    public function show(Request $request): JsonResponse
    {
        $customer = $request->user();

        $membership = Membership::firstOrCreate(
            ['customer_id' => $customer->id],
            [
                'organization_id' => $customer->organization_id,
                'tier' => 'Silver',
                'member_id' => $this->generateMemberId($customer),
                'points' => 0,
                'expires_on' => now()->addYear(),
                'benefits' => [],
            ],
        );

        // Status set explicitly: Laravel answers 201 when the resource's model
        // was created during the request, so a GET that happens to create the
        // membership row would return "Created". Same trap as GET /credit.
        return (new MembershipResource($membership))->response()->setStatusCode(200);
    }

    /**
     * POST /rewards/{id}/redeem — redeem from the app.
     *
     * Only when the venue has switched it on: a collection code nobody at the
     * counter is expecting is worse than no button at all.
     */
    public function redeem(Request $request, string $id, \App\Services\PointsService $points): JsonResponse
    {
        $customer = $request->user();

        $settings = \App\Models\OrganizationSetting::query()
            ->where('organization_id', $customer->organization_id)
            ->first();

        if (! $settings?->self_redeem_enabled) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'reward' => 'สนามนี้ให้แลกของรางวัลที่เคาน์เตอร์เท่านั้น',
            ]);
        }

        $reward = \App\Models\Reward::query()
            ->forOrganization($customer->organization_id)
            ->where('id', $id)
            ->firstOrFail();

        // collectLater: a product has to be handed over, so it becomes a
        // pending promise with a code. Credit and hours land immediately.
        $redemption = $points->redeem($customer, $reward, null, collectLater: true);

        if ($redemption->code) {
            app(\App\Services\NotificationService::class)
                ->redemptionReady($customer, $redemption->name, $redemption->code);
        }

        return response()->json(['data' => $this->presentRedemption($redemption)], 201);
    }

    /** GET /me/redemptions — what I have redeemed, and what I still have to collect. */
    public function myRedemptions(Request $request): JsonResponse
    {
        $rows = \App\Models\RewardRedemption::query()
            ->where('customer_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json(['data' => $rows->map(fn ($r) => $this->presentRedemption($r))->values()]);
    }

    private function presentRedemption(\App\Models\RewardRedemption $r): array
    {
        return [
            'id' => (string) $r->id,
            'name' => $r->name,
            'pointsSpent' => (int) $r->points_spent,
            'type' => $r->type,
            'status' => $r->status,
            // The thing the counter asks for. Null once collected — a code that
            // has been used should stop looking like one that has not.
            'code' => $r->status === 'pending' ? $r->code : null,
            'expiresAt' => $r->expires_at?->toIso8601String(),
            'createdAt' => $r->created_at?->toIso8601String(),
        ];
    }

    /**
     * GET /me/points — the customer's own history.
     *
     * A balance with no history is a number you cannot check. The venue could
     * already see this; the person whose points they are could not.
     */
    public function pointsHistory(Request $request): JsonResponse
    {
        $rows = \App\Models\PointTransaction::query()
            ->where('customer_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        return response()->json([
            'data' => $rows->map(fn ($t) => [
                'id' => (string) $t->id,
                'points' => (int) $t->points,
                'source' => $t->source,
                'label' => $t->label,
                'createdAt' => $t->created_at?->toIso8601String(),
            ])->values(),
        ]);
    }

    /**
     * GET /rewards — what this venue lets points buy.
     *
     * Public to a signed-in customer because it is a price list: knowing "50
     * คะแนน แลกน้ำ" is the only thing that makes a points balance mean anything.
     * Redeeming is still done at the counter.
     */
    public function rewards(Request $request): JsonResponse
    {
        $customer = $request->user();

        $rewards = \App\Models\Reward::query()
            ->forOrganization($customer->organization_id)
            ->where('is_active', true)
            ->with('product')
            ->orderBy('sort_order')
            ->orderBy('points_cost')
            ->get();

        $points = (int) (Membership::where('customer_id', $customer->id)->value('points') ?? 0);

        return response()->json([
            'data' => $rewards->map(fn ($r) => [
                'id' => (string) $r->id,
                'name' => $r->name,
                'pointsCost' => (int) $r->points_cost,
                'type' => $r->type,
                // So the app can show "แลกได้" rather than letting someone walk
                // to the counter to be told no.
                'affordable' => $points >= (int) $r->points_cost,
                'outOfStock' => $r->type === 'product' && (int) ($r->product?->stock_qty ?? 0) < 1,
            ])->values(),
        ]);
    }

    /** Sequential, human-readable member id, e.g. SM-0000123. */
    private function generateMemberId($customer): string
    {
        $seq = Membership::where('organization_id', $customer->organization_id)->count() + 1;

        return 'SM-'.str_pad((string) $seq, 7, '0', STR_PAD_LEFT);
    }

}
