<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdminAuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
class AuditLogController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return AdminAuditLogResource::collection(AuditLog::query()->orderByDesc('created_at')->limit(200)->get());
    }
}
