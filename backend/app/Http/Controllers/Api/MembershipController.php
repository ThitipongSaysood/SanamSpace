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
