<?php

namespace App\Support;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Request;

/**
 * Write down what a platform admin just did.
 *
 * The audit log page, the model and the table all existed; nothing in the
 * codebase ever wrote a row, so the six entries on screen were seeded fixtures
 * and the page had been showing the same fake week since it was built. On a
 * platform where an admin can suspend a venue, move it between packages, hand
 * it free time and log in as its owner, that is the record that matters most.
 *
 * Deliberately not an observer on the models: the interesting thing is the
 * decision, not the column that changed. "เปลี่ยนแพ็กเกจ Starter → Pro" is
 * worth reading; "subscriptions.plan_id updated" is not.
 */
class AdminAudit
{
    public static function record(string $action, ?string $detail = null, ?string $organizationId = null): AuditLog
    {
        $user = Request::user();

        return AuditLog::create([
            'user_id' => $user?->id,
            'organization_id' => $organizationId,
            // Denormalised so the entry still reads correctly after a rename,
            // and still says something when the account is gone.
            'user_name' => $user?->display_name ?: ($user?->name ?: 'ระบบ'),
            'action' => $action,
            'detail' => $detail,
            'ip_address' => Request::ip(),
        ]);
    }
}
