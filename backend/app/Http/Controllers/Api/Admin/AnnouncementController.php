<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminAnnouncementResource;
use App\Models\Announcement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AnnouncementController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return AdminAnnouncementResource::collection(
            Announcement::query()->orderByDesc('created_at')->get(),
        );
    }

    /** POST /admin/announcements — create a new announcement. */
    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request, creating: true);

        $data['published_at'] = ($data['status'] ?? 'draft') === 'published' ? now() : null;

        $announcement = Announcement::create($data);

        return (new AdminAnnouncementResource($announcement))->response()->setStatusCode(201);
    }

    /** PUT /admin/announcements/{id} — edit an announcement. */
    public function update(Request $request, string $id): AdminAnnouncementResource
    {
        $announcement = Announcement::findOrFail($id);
        $data = $this->validateData($request, creating: false);

        // Keep published_at in sync when the status changes.
        if (array_key_exists('status', $data)) {
            $data['published_at'] = $data['status'] === 'published'
                ? ($announcement->published_at ?? now())
                : null;
        }

        $announcement->update($data);

        return new AdminAnnouncementResource($announcement->fresh());
    }

    /** POST /admin/announcements/{id}/toggle — publish ↔ unpublish. */
    public function toggle(string $id): AdminAnnouncementResource
    {
        $announcement = Announcement::findOrFail($id);
        $publishing = $announcement->status !== 'published';

        $announcement->update([
            'status' => $publishing ? 'published' : 'draft',
            'published_at' => $publishing ? ($announcement->published_at ?? now()) : null,
        ]);

        return new AdminAnnouncementResource($announcement->fresh());
    }

    /** DELETE /admin/announcements/{id}. */
    public function destroy(string $id): JsonResponse
    {
        Announcement::findOrFail($id)->delete();

        return response()->json(null, 204);
    }

    private function validateData(Request $request, bool $creating): array
    {
        return $request->validate([
            'title' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'body' => ['sometimes', 'nullable', 'string'],
            'audience' => ['sometimes', 'string', 'in:all,trial,paid'],
            'status' => ['sometimes', 'string', 'in:draft,published'],
        ]);
    }
}
