<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\MembershipResource;
use App\Models\Membership;
use Illuminate\Http\Request;

class MembershipController extends Controller
{
    /**
     * GET /membership -> Membership (current authenticated customer).
     */
    public function show(Request $request): MembershipResource
    {
        $membership = Membership::query()
            ->where('customer_id', $request->user()->id)
            ->firstOrFail();

        return new MembershipResource($membership);
    }
}
