<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnnouncementController extends Controller
{
    /**
     * GET /owner/announcements — published platform announcements targeted to
     * this org (audience 'all' plus its plan tier: trial | paid).
     */
    public function index(Request $request): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $status = Subscription::query()
            ->where('organization_id', $orgId)
            ->orderByDesc('created_at')
            ->value('status');
        $tier = $status === 'active' ? 'paid' : 'trial';

        $rows = Announcement::query()
            ->where('status', 'published')
            ->whereIn('audience', ['all', $tier])
            ->orderByDesc('published_at')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($a) => [
                'id' => (string) $a->id,
                'title' => $a->title,
                'body' => $a->body,
                'publishedAt' => $a->published_at?->toIso8601String(),
            ]);

        return response()->json(['data' => $rows]);
    }
}
