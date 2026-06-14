<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminPaymentResource;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PaymentController extends Controller
{
    /**
     * GET /admin/payments — all payment transactions across every org.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $payments = Payment::query()
            ->with(['organization', 'customer', 'booking'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('created_at')
            ->limit(300)
            ->get();

        return AdminPaymentResource::collection($payments);
    }
}
