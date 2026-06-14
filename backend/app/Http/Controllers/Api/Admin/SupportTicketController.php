<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdminSupportTicketResource;
use App\Models\SupportTicket;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
class SupportTicketController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return AdminSupportTicketResource::collection(SupportTicket::query()->orderByDesc('updated_at')->get());
    }
}
