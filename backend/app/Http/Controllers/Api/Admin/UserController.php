<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminUserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Platform (SanamSpace team) users = super admins.
 *
 * Suspending rather than deleting: an account that has approved payments and
 * answered support tickets should keep its name on those records after the
 * person leaves.
 */
class UserController extends Controller
{
    /** GET /admin/users */
    public function index(): AnonymousResourceCollection
    {
        $users = User::query()
            ->where('is_super_admin', true)
            ->orderBy('created_at')
            ->get();

        return AdminUserResource::collection($users);
    }

    /** POST /admin/users */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'min:8', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'display_name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'], // hashed by the model's cast
            'phone' => $data['phone'] ?? null,
            'is_super_admin' => true,
            'status' => 'active',
        ]);

        return (new AdminUserResource($user))->response()->setStatusCode(201);
    }

    /** PUT /admin/users/{id} */
    public function update(Request $request, string $id): AdminUserResource
    {
        $user = $this->find($id);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'password' => ['sometimes', 'nullable', 'string', 'min:8', 'max:255'],
        ]);

        $updates = [];
        if (array_key_exists('name', $data)) {
            $updates['name'] = $data['name'];
            $updates['display_name'] = $data['name'];
        }
        foreach (['email', 'phone'] as $field) {
            if (array_key_exists($field, $data)) {
                $updates[$field] = $data[$field];
            }
        }
        // Only when something was actually typed — a blank field on an edit
        // form must not wipe someone's password.
        if (filled($data['password'] ?? null)) {
            $updates['password'] = $data['password'];
        }

        if ($updates) {
            $user->update($updates);
        }

        return new AdminUserResource($user->fresh());
    }

    /** POST /admin/users/{id}/suspend — blocks sign-in, keeps the record. */
    public function suspend(Request $request, string $id): AdminUserResource
    {
        $user = $this->find($id);

        // Locking yourself out, or emptying the platform of admins, are both
        // one-way doors with no way back in through the UI.
        if ((string) $user->id === (string) $request->user()->id) {
            throw ValidationException::withMessages(['id' => 'ระงับบัญชีของตัวเองไม่ได้']);
        }

        if ($this->activeSuperAdmins() <= 1) {
            throw ValidationException::withMessages([
                'id' => 'ต้องเหลือผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 คน',
            ]);
        }

        $user->update(['status' => 'suspended']);
        // Suspension has to bite now, not at the next login — the tokens they
        // are already holding would otherwise keep working indefinitely.
        $user->tokens()->delete();

        return new AdminUserResource($user->fresh());
    }

    /** POST /admin/users/{id}/activate */
    public function activate(string $id): AdminUserResource
    {
        $user = $this->find($id);
        $user->update(['status' => 'active']);

        return new AdminUserResource($user->fresh());
    }

    private function find(string $id): User
    {
        return User::query()->where('is_super_admin', true)->findOrFail($id);
    }

    private function activeSuperAdmins(): int
    {
        return User::query()
            ->where('is_super_admin', true)
            ->where('status', 'active')
            ->count();
    }
}
