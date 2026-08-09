<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminAuditLogResource;
use App\Models\AuditLog;
use App\Models\Organization;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AuditLogController extends Controller
{
    /**
     * GET /admin/audit-logs?organizationId=&limit=
     *
     * `organizationId` accepts a slug as well as a uuid, because every admin
     * screen addresses a venue by slug and the drawer asking "what has been
     * done to this venue" should not have to translate first.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = AuditLog::query()->orderByDesc('created_at');

        if ($orgId = $request->query('organizationId')) {
            $resolved = Organization::query()
                ->where('slug', $orgId)->orWhere('id', $orgId)
                ->value('id');

            // An unknown venue returns nothing rather than everything: a
            // filter that silently falls back to the whole platform is how a
            // log of one venue turns into a log of all of them.
            $query->where('organization_id', $resolved ?? '-');
        }

        $limit = min(500, max(1, (int) $request->query('limit', 200)));

        return AdminAuditLogResource::collection($query->limit($limit)->get());
    }
}
