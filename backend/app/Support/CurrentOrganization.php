<?php

namespace App\Support;

use App\Models\Customer;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

/**
 * Resolves the "current organization" (tenant) for the request.
 *
 * For now this is simple: it derives the org from the authenticated
 * customer/user, falling back to the default tenant. This keeps the
 * multi-tenant concept present without full tenancy plumbing.
 */
class CurrentOrganization
{
    protected static ?Organization $resolved = null;

    public static function set(?Organization $organization): void
    {
        static::$resolved = $organization;
    }

    public static function get(): ?Organization
    {
        if (static::$resolved) {
            return static::$resolved;
        }

        $user = Auth::user();

        if ($user instanceof Customer) {
            return static::$resolved = $user->organization;
        }

        if ($user instanceof User) {
            $membership = $user->organizationUsers()->first();
            if ($membership) {
                return static::$resolved = $membership->organization;
            }
        }

        return static::$resolved = static::default();
    }

    public static function id(): ?string
    {
        return static::get()?->id;
    }

    public static function default(): ?Organization
    {
        return Organization::query()->orderBy('created_at')->first();
    }
}
