<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\SubscriptionResource;
use App\Models\Subscription;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SubscriptionController extends Controller
{
    /**
     * GET /admin/subscriptions — ALL subscriptions across every organization.
     */
    public function index(): AnonymousResourceCollection
    {
        $subscriptions = Subscription::query()
            ->with(['organization', 'plan'])
            ->orderBy('created_at')
            ->get();

        return SubscriptionResource::collection($subscriptions);
    }
}
