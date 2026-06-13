<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerWalletResource;
use App\Models\Wallet;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class WalletController extends Controller
{
    /**
     * GET /owner/wallets — org wallets joined to their customer, with a
     * per-wallet transaction count.
     * Each item: { id, customerName, balance, transactionCount }
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $wallets = Wallet::query()
            ->forOrganization($orgId)
            ->with('customer')
            ->withCount('transactions')
            ->orderByDesc('balance')
            ->get();

        return OwnerWalletResource::collection($wallets);
    }
}
