<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Api\Concerns\PaginatesLists;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdminTransactionResource;
use App\Models\PlatformTransaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
class TransactionController extends Controller
{
    use PaginatesLists;

    public function index(Request $request): AnonymousResourceCollection
    {
        return AdminTransactionResource::collection(
            $this->paginated(PlatformTransaction::query()->orderByDesc('created_at'), $request),
        );
    }
}
