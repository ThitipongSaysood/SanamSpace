<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Follow-ups the venue owes a customer — call back, chase a deposit, win a
 * churned regular back. Open or done; toggling done stamps completed_at.
 */
class CustomerTaskController extends Controller
{
    public function store(Request $request, string $customerId): JsonResponse
    {
        $orgId = $request->attributes->get('currentOrganizationId');
        $customer = Customer::query()->forOrganization($orgId)->findOrFail($customerId);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'dueAt' => ['nullable', 'date_format:Y-m-d'],
            'assignedTo' => ['nullable', 'string', Rule::exists('organization_users', 'user_id')->where('organization_id', $orgId)],
        ]);

        $task = CustomerTask::create([
            'organization_id' => $orgId,
            'customer_id' => $customer->id,
            'title' => $data['title'],
            'due_at' => $data['dueAt'] ?? null,
            'assigned_to' => $data['assignedTo'] ?? null,
            'created_by' => $request->user()?->id,
            'status' => 'open',
        ]);

        return response()->json(['data' => $this->present($task->fresh('assignee'))], 201);
    }

    /** POST /owner/customers/{id}/tasks/{taskId}/toggle — flip open <-> done. */
    public function toggle(Request $request, string $customerId, string $taskId): JsonResponse
    {
        $task = $this->find($request, $customerId, $taskId);

        $done = $task->status !== 'done';
        $task->update([
            'status' => $done ? 'done' : 'open',
            'completed_at' => $done ? now() : null,
        ]);

        return response()->json(['data' => $this->present($task->fresh('assignee'))]);
    }

    public function destroy(Request $request, string $customerId, string $taskId): JsonResponse
    {
        $this->find($request, $customerId, $taskId)->delete();

        return response()->json(['id' => (string) $taskId, 'deleted' => true]);
    }

    private function find(Request $request, string $customerId, string $taskId): CustomerTask
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        return CustomerTask::query()
            ->forOrganization($orgId)
            ->where('customer_id', $customerId)
            ->where('id', $taskId)
            ->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function present(CustomerTask $task): array
    {
        return [
            'id' => (string) $task->id,
            'title' => $task->title,
            'dueAt' => $task->due_at?->toDateString(),
            'assignee' => $task->assignee?->display_name ?? $task->assignee?->name,
            'status' => $task->status,
            'completedAt' => $task->completed_at,
        ];
    }
}
