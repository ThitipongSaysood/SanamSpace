<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdminInvoiceResource;
use App\Models\Invoice;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
class InvoiceController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return AdminInvoiceResource::collection(Invoice::query()->orderByDesc('issue_date')->orderByDesc('created_at')->get());
    }
}
