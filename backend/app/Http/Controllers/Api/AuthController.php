<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\Customer;
use App\Models\LineProfile;
use App\Models\Organization;
use App\Models\OrganizationSetting;
use App\Models\User;
use App\Services\LineTokenVerifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * POST /auth/line/login
     *
     * Real LINE login when a channel is configured — the resolved org's LINE
     * channel (organization_settings.line_channel_id) first, else the global
     * services.line.channel_id (.env). When configured, the client must send a
     * LIFF `idToken`, which is verified against LINE (for that channel) and the
     * trusted `sub`/profile is used. When no channel is configured the endpoint
     * falls back to the dev/test stub (trusts the supplied lineUserId or a stub
     * `code`). Either way it upserts a Customer for the current/default org and
     * returns { token, user }.
     */
    public function lineLogin(Request $request, LineTokenVerifier $verifier): JsonResponse
    {
        $data = $request->validate([
            'idToken' => ['nullable', 'string'],
            'lineUserId' => ['nullable', 'string'],
            'displayName' => ['nullable', 'string'],
            'code' => ['nullable', 'string'],
            'pictureUrl' => ['nullable', 'string'],
            'email' => ['nullable', 'email'],
            'phone' => ['nullable', 'string'],
            'organizationSlug' => ['nullable', 'string'],
        ]);

        // Resolve the org FIRST so verification can use its per-venue LINE channel.
        $organization = $this->resolveOrganization($data['organizationSlug'] ?? null);

        if (! $organization) {
            throw ValidationException::withMessages([
                'organization' => 'No organization available.',
            ]);
        }

        $settings = $organization->settings
            ?? OrganizationSetting::firstOrCreate(['organization_id' => $organization->id]);

        if ($verifier->isConfigured($settings)) {
            // Real mode: only a LINE-verified id_token is trusted (org channel first).
            $profile = $verifier->verify($data['idToken'] ?? null, $settings);
            $lineUserId = $profile['lineUserId'];
            $displayName = $profile['displayName'];
            $pictureUrl = $profile['pictureUrl'];
            $email = $profile['email'];
            $phone = null; // LINE id_token has no phone; customer sets it via /auth/me.
        } else {
            // Dev/test fallback: derive a LINE user id from payload or stub code.
            $lineUserId = $data['lineUserId']
                ?? ($data['code'] ?? null ? 'U'.substr(hash('sha256', $data['code']), 0, 32) : null);

            if (! $lineUserId) {
                throw ValidationException::withMessages([
                    'lineUserId' => 'Provide lineUserId or code.',
                ]);
            }

            $displayName = $data['displayName'] ?? null;
            $pictureUrl = $data['pictureUrl'] ?? null;
            $email = $data['email'] ?? null;
            $phone = $data['phone'] ?? null;
        }

        $customer = Customer::firstOrNew([
            'organization_id' => $organization->id,
            'line_user_id' => $lineUserId,
        ]);

        $customer->display_name = $displayName ?? $customer->display_name ?? 'LINE User';
        $customer->picture_url = $pictureUrl ?? $customer->picture_url;
        $customer->email = $email ?? $customer->email;
        $customer->phone = $phone ?? $customer->phone;
        $customer->save();

        // Keep a denormalised LINE profile snapshot.
        LineProfile::updateOrCreate(
            ['customer_id' => $customer->id, 'line_user_id' => $lineUserId],
            ['display_name' => $customer->display_name, 'picture_url' => $customer->picture_url],
        );

        $token = $customer->createToken('line-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new UserResource($customer),
        ]);
    }

    /**
     * GET /line-config — public per-venue LINE config for the customer frontend.
     *
     * Resolves the org from ?organizationSlug (else the default org) and returns
     * its LIFF id so the SPA can init LIFF for the right channel. Returns null
     * when the org (or no org) has no LIFF configured. Never exposes secrets.
     */
    public function lineConfig(Request $request): JsonResponse
    {
        $organization = $this->resolveOrganization($request->query('organizationSlug'));
        $settings = $organization?->settings;

        return response()->json([
            'liffId' => $settings?->line_liff_id,
        ]);
    }

    /**
     * POST /auth/admin/login — email + password for owner/admin users.
     */
    public function adminLogin(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'Invalid credentials.',
            ]);
        }

        // A suspended account keeps its records but must not get back in.
        // Checked after the password so a wrong password and a suspended
        // account are not distinguishable to someone guessing.
        if ($user->status === 'suspended') {
            throw ValidationException::withMessages([
                'email' => 'บัญชีนี้ถูกระงับการใช้งาน',
            ]);
        }

        $token = $user->createToken('admin-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user),
        ]);
    }

    /**
     * GET /auth/me — current authenticated user (customer or admin).
     */
    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    /**
     * PUT /auth/me — update the current customer's profile.
     *
     * Accepts camelCase displayName plus email/phone; returns the updated User.
     */
    public function updateMe(Request $request): UserResource
    {
        $data = $request->validate([
            'displayName' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
        ]);

        $user = $request->user();

        if (array_key_exists('displayName', $data)) {
            $user->display_name = $data['displayName'];
        }
        if (array_key_exists('email', $data)) {
            $user->email = $data['email'];
        }
        if (array_key_exists('phone', $data)) {
            $user->phone = $data['phone'];
        }

        $user->save();

        return new UserResource($user);
    }

    /**
     * POST /auth/logout — revoke the current access token.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    /**
     * The venue a login belongs to, from the /v/{slug} the customer came from.
     *
     * A customer is created inside one organization and stays there, so binding
     * them to the wrong one is not recoverable — an unknown slug is rejected
     * rather than silently redirected to some other venue. The only fallback is
     * a single-organization install, where there is nothing to get wrong.
     */
    private function resolveOrganization(?string $slug): ?Organization
    {
        if ($slug) {
            return Organization::where('slug', $slug)->first();
        }

        return Organization::query()->count() === 1
            ? Organization::query()->first()
            : null;
    }
}
