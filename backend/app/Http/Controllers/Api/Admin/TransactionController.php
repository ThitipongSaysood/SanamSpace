<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdminTransactionResource;
use App\Models\PlatformTransaction;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
class TransactionController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return AdminTransactionResource::collection(PlatformTransaction::query()->orderByDesc('created_at')->get());
    }
}
