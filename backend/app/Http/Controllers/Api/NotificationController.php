<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class NotificationController extends Controller
{
    /**
     * GET /notifications -> AppNotification[]
     *
     * The authenticated customer's notifications plus any org-wide broadcasts
     * (customer_id null) for their organization.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $customer = $request->user();

        $notifications = Notification::query()
            ->where('organization_id', $customer->organization_id)
            ->where(function ($q) use ($customer) {
                $q->where('customer_id', $customer->id)
                    ->orWhereNull('customer_id');
            })
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->get();

        return NotificationResource::collection($notifications);
    }
}
