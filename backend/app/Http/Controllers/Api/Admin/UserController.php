<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminUserResource;
use App\Models\User;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class UserController extends Controller
{
    /**
     * GET /admin/users — platform (SanamSpace team) users = super admins.
     */
    public function index(): AnonymousResourceCollection
    {
        $users = User::query()
            ->where('is_super_admin', true)
            ->orderBy('created_at')
            ->get();

        return AdminUserResource::collection($users);
    }
}
