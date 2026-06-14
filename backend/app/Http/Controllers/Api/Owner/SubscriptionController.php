<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\SubscriptionResource;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    /**
     * GET /owner/subscription — the current org's active subscription
     * (plan + status + endsAt + daysRemaining). Returns {data:null} if none.
     */
    public function show(Request $request): JsonResponse|SubscriptionResource
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $sub = Subscription::query()
            ->forOrganization($orgId)
            ->with(['plan', 'organization'])
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderByDesc('created_at')
            ->first();

        return $sub ? new SubscriptionResource($sub) : response()->json(['data' => null]);
    }
}
