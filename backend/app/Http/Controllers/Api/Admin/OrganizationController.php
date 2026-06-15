<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminOrganizationDetailResource;
use App\Http\Resources\AdminOrganizationResource;
use App\Http\Resources\UserResource;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Plan;
use App\Models\Role;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OrganizationController extends Controller
{
    /**
     * GET /admin/organizations — ALL organizations (platform-level, no scoping).
     */
    public function index(): AnonymousResourceCollection
    {
        $organizations = Organization::query()
            ->with(['activeSubscription.plan', 'settings', 'organizationUsers.user', 'organizationUsers.role'])
            ->withCount(['branches', 'courts', 'customers'])
            ->withSum(['bookings as revenue' => fn ($q) => $q->whereIn('status', ['confirmed', 'completed'])], 'amount')
            ->orderBy('created_at')
            ->get();

        return AdminOrganizationResource::collection($organizations);
    }

    /**
     * POST /admin/organizations — create a new tenant (org + settings + owner +
     * optional subscription).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'ownerName' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'planId' => ['nullable', 'string', Rule::exists('plans', 'id')],
        ]);

        $org = Organization::create([
            'name' => $data['name'],
            'slug' => $this->uniqueSlug($data['name']),
            'status' => 'active',
        ]);

        $org->settings()->create(['email' => $data['email'], 'phone' => $data['phone'] ?? null]);

        if (! empty($data['planId'])) {
            Subscription::create([
                'organization_id' => $org->id,
                'plan_id' => $data['planId'],
                'status' => 'active',
                'started_at' => now(),
                'ends_at' => now()->addDays(30),
            ]);
        }

        // Owner user (reuse if the email already exists) + org membership.
        $user = User::firstOrCreate(
            ['email' => $data['email']],
            ['name' => $data['ownerName'], 'display_name' => $data['ownerName'], 'password' => Str::random(24)],
        );
        OrganizationUser::firstOrCreate(
            ['organization_id' => $org->id, 'user_id' => $user->id],
            ['role_id' => Role::where('code', 'owner')->value('id'), 'display_name' => $data['ownerName'], 'status' => 'active', 'joined_at' => now()],
        );

        return (new AdminOrganizationDetailResource($this->load($org->fresh())))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * GET /admin/organizations/{id} — single org detail (id = slug or uuid).
     */
    public function show(string $id): AdminOrganizationDetailResource
    {
        return new AdminOrganizationDetailResource($this->load($this->find($id)));
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'org';
        $slug = $base;
        $i = 1;
        while (Organization::withTrashed()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.(++$i);
        }

        return $slug;
    }

    /** POST /admin/organizations/{id}/suspend — block the org from using the system. */
    public function suspend(string $id): AdminOrganizationDetailResource
    {
        $org = $this->find($id);
        $org->update(['status' => 'suspended']);

        return new AdminOrganizationDetailResource($this->load($org));
    }

    /** POST /admin/organizations/{id}/activate — re-enable a suspended org. */
    public function activate(string $id): AdminOrganizationDetailResource
    {
        $org = $this->find($id);
        $org->update(['status' => 'active']);

        return new AdminOrganizationDetailResource($this->load($org));
    }

    /**
     * PUT /admin/organizations/{id}/settings — platform override of the org's
     * per-venue LINE integration. Secrets are write-only: they are only updated
     * when a non-empty value is provided, and never returned (see the resource).
     */
    public function updateSettings(Request $request, string $id): AdminOrganizationDetailResource
    {
        $data = $request->validate([
            'lineChannelId' => ['nullable', 'string', 'max:255'],
            'lineLiffId' => ['nullable', 'string', 'max:255'],
            'lineChannelSecret' => ['nullable', 'string', 'max:500'],
            'lineMessagingToken' => ['nullable', 'string', 'max:2000'],
        ]);

        $org = $this->find($id);
        $settings = $org->settings ?? $org->settings()->create([]);

        $attrs = [];
        if ($request->has('lineChannelId')) {
            $attrs['line_channel_id'] = $data['lineChannelId'] ?: null;
        }
        if ($request->has('lineLiffId')) {
            $attrs['line_liff_id'] = $data['lineLiffId'] ?: null;
        }
        // Secrets: only write when a non-empty value is given — never wipe on blank.
        if (filled($data['lineChannelSecret'] ?? null)) {
            $attrs['line_channel_secret'] = $data['lineChannelSecret'];
        }
        if (filled($data['lineMessagingToken'] ?? null)) {
            $attrs['line_messaging_token'] = $data['lineMessagingToken'];
        }

        if ($attrs) {
            $settings->update($attrs);
        }

        return new AdminOrganizationDetailResource($this->load($org->fresh()));
    }

    /** PUT /admin/organizations/{id}/plan — change the org's subscription plan. */
    public function changePlan(Request $request, string $id): AdminOrganizationDetailResource
    {
        $data = $request->validate([
            'planId' => ['required', 'string', Rule::exists('plans', 'id')],
        ]);

        $org = $this->find($id);
        $subscription = $org->activeSubscription ?? $org->subscriptions()->latest('created_at')->first();

        if ($subscription) {
            $subscription->update(['plan_id' => $data['planId']]);
        } else {
            Subscription::create([
                'organization_id' => $org->id,
                'plan_id' => $data['planId'],
                'status' => 'active',
                'started_at' => now(),
            ]);
        }

        return new AdminOrganizationDetailResource($this->load($org->fresh()));
    }

    /** DELETE /admin/organizations/{id} — soft-delete the organization. */
    public function destroy(string $id): JsonResponse
    {
        $this->find($id)->delete();

        return response()->json(null, 204);
    }

    /**
     * POST /admin/organizations/{id}/impersonate — issue an owner-portal token
     * for the org's owner so the super admin can act on their behalf.
     */
    public function impersonate(string $id): JsonResponse
    {
        $org = Organization::query()
            ->with(['organizationUsers.user', 'organizationUsers.role'])
            ->where('slug', $id)->orWhere('id', $id)
            ->firstOrFail();

        $membership = $org->organizationUsers->firstWhere(fn ($m) => $m->role?->code === 'owner')
            ?? $org->organizationUsers->first();
        $user = $membership?->user;

        if (! $user) {
            throw ValidationException::withMessages(['owner' => 'องค์กรนี้ยังไม่มีเจ้าของให้สวมสิทธิ์']);
        }

        $token = $user->createToken('impersonate-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user),
        ]);
    }

    private function find(string $id): Organization
    {
        return Organization::query()->where('slug', $id)->orWhere('id', $id)->firstOrFail();
    }

    private function load(Organization $org): Organization
    {
        return $org->load(['activeSubscription.plan', 'settings', 'organizationUsers.user', 'organizationUsers.role'])
            ->loadCount(['branches', 'courts', 'customers']);
    }
}
