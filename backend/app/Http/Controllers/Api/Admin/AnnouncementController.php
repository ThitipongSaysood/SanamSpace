<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdminAnnouncementResource;
use App\Models\Announcement;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
class AnnouncementController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return AdminAnnouncementResource::collection(Announcement::query()->orderByDesc('created_at')->get());
    }
}
