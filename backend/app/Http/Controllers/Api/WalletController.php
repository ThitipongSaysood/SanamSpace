<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\WalletResource;
use App\Models\Wallet;
use Illuminate\Http\Request;

class WalletController extends Controller
{
    /**
     * GET /wallet -> Wallet (current authenticated customer, with txns).
     */
    public function show(Request $request): WalletResource
    {
        $wallet = Wallet::query()
            ->with(['transactions' => fn ($q) => $q->orderBy('sort_order')])
            ->where('customer_id', $request->user()->id)
            ->firstOrFail();

        return new WalletResource($wallet);
    }
}
