<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerNote;
use App\Models\CustomerTimelineEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Free-text notes staff attach to a customer. Adding one also drops a `note`
 * entry on the customer's timeline, so the annotation and the activity trail
 * agree — the timeline `note` type finally has a writer.
 */
class CustomerNoteController extends Controller
{
    public function store(Request $request, string $customerId): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $customer = Customer::query()->forOrganization($orgId)->findOrFail($customerId);

        $data = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $note = CustomerNote::create([
            'organization_id' => $orgId,
            'customer_id' => $customer->id,
            'author_id' => $request->user()?->id,
            'body' => $data['body'],
        ]);

        CustomerTimelineEntry::create([
            'organization_id' => $orgId,
            'customer_id' => $customer->id,
            'type' => 'note',
            'title' => 'บันทึกจากพนักงาน',
            'description' => $data['body'],
            'occurred_at' => now(),
        ]);

        return response()->json(['data' => $this->present($note->fresh('author'))], 201);
    }

    public function destroy(Request $request, string $customerId, string $noteId): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $note = CustomerNote::query()
            ->forOrganization($orgId)
            ->where('customer_id', $customerId)
            ->where('id', $noteId)
            ->firstOrFail();

        $note->delete();

        return response()->json(['id' => (string) $noteId, 'deleted' => true]);
    }

    /** @return array<string, mixed> */
    private function present(CustomerNote $note): array
    {
        return [
            'id' => (string) $note->id,
            'body' => $note->body,
            'author' => $note->author?->display_name ?? $note->author?->name,
            'createdAt' => $note->created_at,
        ];
    }
}
