<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Court;
use App\Models\Sport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The platform's sport catalogue.
 *
 * Every screen that draws a sport — the app's loading screen, the notification
 * icon, the venue's court form, the customer's "เลือกประเภทกีฬา" — reads from
 * here. Adding a sport used to mean editing frontend files and shipping a
 * release; it is a row now.
 */
class SportController extends Controller
{
    public function index(): JsonResponse
    {
        $sports = Sport::query()->ordered()->get();
        $usage = $this->usage();

        return response()->json([
            'data' => $sports->map(fn (Sport $s) => $this->present($s, $usage[$s->key] ?? 0))->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $sport = Sport::create($data + [
            'sort_order' => $data['sort_order'] ?? ((int) Sport::max('sort_order') + 10),
        ]);

        return response()->json(['data' => $this->present($sport, 0)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $sport = Sport::findOrFail($id);
        $sport->update($this->validated($request, $sport));

        return response()->json(['data' => $this->present($sport, $this->usage()[$sport->key] ?? 0)]);
    }

    /**
     * Removed only while nothing points at it.
     *
     * The key is a plain string on `courts.sport` and `branches.sports` with no
     * foreign key behind it, so deleting a sport in use would not fail — it
     * would leave courts naming something that no longer exists and quietly
     * take their icon away. Deactivating is the answer for a sport that is
     * still in the ground; deleting is for a row typed by mistake.
     */
    public function destroy(string $id): JsonResponse
    {
        $sport = Sport::findOrFail($id);
        $used = $this->usage()[$sport->key] ?? 0;

        if ($used > 0) {
            throw ValidationException::withMessages([
                'key' => "ยังมี {$used} สนามใช้กีฬานี้อยู่ — ปิดการใช้งานแทนการลบ",
            ]);
        }

        $sport->delete();

        return response()->json(['deleted' => true]);
    }

    /**
     * @return array<string, int> key => how many venues offer it
     */
    private function usage(): array
    {
        $counts = Court::query()
            ->selectRaw('sport, count(distinct organization_id) as venues')
            ->groupBy('sport')
            ->pluck('venues', 'sport')
            ->map(fn ($n) => (int) $n)
            ->all();

        // A branch can list a sport it has no court for yet — that still counts
        // as in use, because it is what themes that venue's app.
        foreach (Branch::query()->whereNotNull('sports')->get(['organization_id', 'sports']) as $branch) {
            foreach ((array) $branch->sports as $key) {
                $counts[$key] = max($counts[$key] ?? 0, 1);
            }
        }

        return $counts;
    }

    private function validated(Request $request, ?Sport $existing = null): array
    {
        return $request->validate([
            // Lower-case ascii: it is a lookup key stored on other tables, not
            // a label. The label is `name`, and that is free.
            'key' => [
                $existing ? 'sometimes' : 'required',
                'string',
                'max:50',
                'regex:/^[a-z][a-z0-9_]*$/',
                Rule::unique('sports', 'key')->ignore($existing?->id),
            ],
            'name' => [$existing ? 'sometimes' : 'required', 'string', 'max:100'],
            'emoji' => [$existing ? 'sometimes' : 'required', 'string', 'max:16'],
            'color' => [$existing ? 'sometimes' : 'required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ], [
            'key.regex' => 'รหัสกีฬาใช้ได้เฉพาะ a-z, 0-9 และ _ และต้องขึ้นต้นด้วยตัวอักษร',
            'color.regex' => 'สีต้องเป็นรหัสฐานสิบหก เช่น #10b981',
        ]);
    }

    private function present(Sport $sport, int $venues): array
    {
        return $sport->toMeta() + [
            'id' => (string) $sport->id,
            'sortOrder' => $sport->sort_order,
            'isActive' => $sport->is_active,
            // Shown next to the delete button so the operator knows what a
            // removal would take with it before they reach for it.
            'venueCount' => $venues,
        ];
    }
}
