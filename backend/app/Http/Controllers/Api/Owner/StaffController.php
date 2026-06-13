<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerRoleResource;
use App\Http\Resources\OwnerStaffResource;
use App\Models\OrganizationUser;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class StaffController extends Controller
{
    /**
     * GET /owner/staff — org members (organization_users joined to users + role).
     * Each item: { id(userId), displayName, email, roleName, status, joinedAt }
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $staff = OrganizationUser::query()
            ->forOrganization($orgId)
            ->with(['user', 'role'])
            ->orderBy('created_at')
            ->get();

        return OwnerStaffResource::collection($staff);
    }

    /**
     * POST /owner/staff — invite a staff member to the current org.
     *
     * Creates a User (with a random password) and an organization_users row
     * (current org, given role, status 'active', joined_at now). Returns 422 if
     * the email is already a member of THIS org. If a User already exists for the
     * email (e.g. staff at another org), that User is reused for the new membership.
     */
    public function store(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'displayName' => ['required', 'string', 'max:255'],
            'roleId' => ['required', 'string', 'exists:roles,id'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        // Already a member of THIS org -> 422.
        if ($user && OrganizationUser::query()
            ->forOrganization($orgId)
            ->where('user_id', $user->id)
            ->exists()) {
            abort(422, 'This email is already a staff member of this organization.');
        }

        // Reuse an existing User for the email, else create one with a random password.
        if (! $user) {
            $user = User::create([
                'name' => $validated['displayName'],
                'display_name' => $validated['displayName'],
                'email' => $validated['email'],
                'password' => Hash::make(Str::random(32)),
            ]);
        }

        $membership = OrganizationUser::create([
            'organization_id' => $orgId,
            'user_id' => $user->id,
            'role_id' => $validated['roleId'],
            'display_name' => $validated['displayName'],
            'status' => 'active',
            'joined_at' => now(),
        ]);

        return (new OwnerStaffResource($membership->load(['user', 'role'])))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * GET /owner/roles — roles available to the current org: the shared system
     * roles (organization_id = null) plus any roles owned by this org.
     * Each item: { id, name, isSystemRole }
     */
    public function roles(Request $request): AnonymousResourceCollection
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $roles = Role::query()
            ->where(function ($q) use ($orgId) {
                $q->whereNull('organization_id')
                    ->orWhere('organization_id', $orgId);
            })
            ->orderByDesc('is_system_role')
            ->orderBy('name')
            ->get();

        return OwnerRoleResource::collection($roles);
    }
}
