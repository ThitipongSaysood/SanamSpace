<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\Customer;
use App\Models\LineProfile;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * POST /auth/line/login
     *
     * Stubs LINE verification: trusts the supplied lineUserId/displayName
     * (or a stub `code`), upserts a Customer for the current/default org,
     * and returns { token, user }.
     *
     * TODO: verify the LINE id token / exchange `code` with LINE's API.
     */
    public function lineLogin(Request $request): JsonResponse
    {
        $data = $request->validate([
            'lineUserId' => ['nullable', 'string'],
            'displayName' => ['nullable', 'string'],
            'code' => ['nullable', 'string'],
            'pictureUrl' => ['nullable', 'string'],
            'email' => ['nullable', 'email'],
            'phone' => ['nullable', 'string'],
            'organizationSlug' => ['nullable', 'string'],
        ]);

        // Stub: derive a LINE user id from payload or the stub code.
        $lineUserId = $data['lineUserId']
            ?? ($data['code'] ?? null ? 'U'.substr(hash('sha256', $data['code']), 0, 32) : null);

        if (! $lineUserId) {
            throw ValidationException::withMessages([
                'lineUserId' => 'Provide lineUserId or code.',
            ]);
        }

        $organization = $this->resolveOrganization($data['organizationSlug'] ?? null);

        if (! $organization) {
            throw ValidationException::withMessages([
                'organization' => 'No organization available.',
            ]);
        }

        $customer = Customer::firstOrNew([
            'organization_id' => $organization->id,
            'line_user_id' => $lineUserId,
        ]);

        $customer->display_name = $data['displayName'] ?? $customer->display_name ?? 'LINE User';
        $customer->picture_url = $data['pictureUrl'] ?? $customer->picture_url;
        $customer->email = $data['email'] ?? $customer->email;
        $customer->phone = $data['phone'] ?? $customer->phone;
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
     * POST /auth/logout — revoke the current access token.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    private function resolveOrganization(?string $slug): ?Organization
    {
        if ($slug) {
            $org = Organization::where('slug', $slug)->first();
            if ($org) {
                return $org;
            }
        }

        return Organization::query()->orderBy('created_at')->first();
    }
}
