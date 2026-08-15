<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminInvoiceResource;
use App\Http\Resources\AdminOrganizationDetailResource;
use App\Http\Resources\AdminOrganizationResource;
use App\Http\Resources\UserResource;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Plan;
use App\Models\Role;
use App\Models\User;
use App\Services\SubscriptionRenewalService;
use App\Support\AdminAudit;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OrganizationController extends Controller
{
    public function __construct(private SubscriptionRenewalService $renewals) {}

    /**
     * GET /admin/organizations — ALL organizations (platform-level, no scoping).
     */
    public function index(): AnonymousResourceCollection
    {
        $organizations = Organization::query()
            ->with(['activeSubscription.plan', 'settings', 'organizationUsers.user', 'organizationUsers.role'])
            ->withCount(['branches', 'courts', 'customers'])
            ->withSum(['bookings as revenue' => fn ($q) => $q->whereIn('status', ['confirmed', 'completed'])], 'amount')
            ->orderBy('created_at')
            ->get();

        return AdminOrganizationResource::collection($organizations);
    }

    /**
     * POST /admin/organizations — create a new tenant (org + settings + owner +
     * optional subscription).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'ownerName' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'planId' => ['nullable', 'string', Rule::exists('plans', 'id')],
        ]);

        $org = Organization::create([
            'name' => $data['name'],
            'slug' => $this->uniqueSlug($data['name']),
            'status' => 'active',
        ]);

        $org->settings()->create(['email' => $data['email'], 'phone' => $data['phone'] ?? null]);

        if (! empty($data['planId'])) {
            // Go through startTrial so the 30 days are recorded as a trial
            // (trial_start_at/trial_end_at on the org), not just an ends_at that
            // reads like a paid subscription about to lapse.
            $this->renewals->startTrial($org, Plan::findOrFail($data['planId']), 30);
        }

        // Owner user (reuse if the email already exists) + org membership.
        $user = User::firstOrCreate(
            ['email' => $data['email']],
            ['name' => $data['ownerName'], 'display_name' => $data['ownerName'], 'password' => Str::random(24)],
        );
        OrganizationUser::firstOrCreate(
            ['organization_id' => $org->id, 'user_id' => $user->id],
            ['role_id' => Role::where('code', 'owner')->value('id'), 'display_name' => $data['ownerName'], 'status' => 'active', 'joined_at' => now()],
        );

        AdminAudit::record('สร้างสนามใหม่', "{$org->name} · เจ้าของ {$data['email']}", $org->id);

        return (new AdminOrganizationDetailResource($this->load($org->fresh())))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * GET /admin/organizations/{id} — single org detail (id = slug or uuid).
     */
    public function show(string $id): AdminOrganizationDetailResource
    {
        return new AdminOrganizationDetailResource($this->load($this->find($id)));
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'org';
        $slug = $base;
        $i = 1;
        while (Organization::withTrashed()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.(++$i);
        }

        return $slug;
    }

    /** POST /admin/organizations/{id}/suspend — block the org from using the system. */
    public function suspend(string $id): AdminOrganizationDetailResource
    {
        $org = $this->find($id);
        $org->update(['status' => 'suspended']);
        AdminAudit::record('ระงับการใช้งานสนาม', $org->name, $org->id);

        return new AdminOrganizationDetailResource($this->load($org));
    }

    /** POST /admin/organizations/{id}/activate — re-enable a suspended org. */
    public function activate(string $id): AdminOrganizationDetailResource
    {
        $org = $this->find($id);
        $org->update(['status' => 'active']);
        AdminAudit::record('เปิดใช้งานสนาม', $org->name, $org->id);

        return new AdminOrganizationDetailResource($this->load($org));
    }

    /**
     * PUT /admin/organizations/{id}/settings — platform override of the org's
     * per-venue LINE integration. Secrets are write-only: they are only updated
     * when a non-empty value is provided, and never returned (see the resource).
     */
    public function updateSettings(Request $request, string $id): AdminOrganizationDetailResource
    {
        $data = $request->validate([
            'lineChannelId' => ['nullable', 'string', 'max:255'],
            'lineLiffId' => ['nullable', 'string', 'max:255'],
            'lineChannelSecret' => ['nullable', 'string', 'max:500'],
            'lineMessagingToken' => ['nullable', 'string', 'max:2000'],
        ]);

        $org = $this->find($id);
        $settings = $org->settings ?? $org->settings()->create([]);

        $attrs = [];
        if ($request->has('lineChannelId')) {
            $attrs['line_channel_id'] = $data['lineChannelId'] ?: null;
        }
        if ($request->has('lineLiffId')) {
            $attrs['line_liff_id'] = $data['lineLiffId'] ?: null;
        }
        // Secrets: only write when a non-empty value is given — never wipe on blank.
        if (filled($data['lineChannelSecret'] ?? null)) {
            $attrs['line_channel_secret'] = $data['lineChannelSecret'];
        }
        if (filled($data['lineMessagingToken'] ?? null)) {
            $attrs['line_messaging_token'] = $data['lineMessagingToken'];
        }

        if ($attrs) {
            $settings->update($attrs);
        }

        return new AdminOrganizationDetailResource($this->load($org->fresh()));
    }

    /**
     * POST /admin/organizations/{id}/owner/reset-link
     *
     * Send this venue's owner a link to set their own password.
     *
     * The gap this closes: `store()` creates the owner with `Str::random(24)`
     * and sends it nowhere, so a venue onboarded from this screen could not be
     * opened by the person it was created for. The admin had no action to fix
     * it and the owner had no way to ask.
     *
     * The same broker the public "ลืมรหัสผ่าน" uses — one mechanism, two doors
     * — so the admin never learns or handles the password themselves.
     */
    public function sendOwnerResetLink(string $id): JsonResponse
    {
        $org = $this->find($id);

        $membership = $org->organizationUsers()
            ->with(['user', 'role'])
            ->get()
            ->first(fn ($m) => $m->role?->code === 'owner') ?? $org->organizationUsers()->with('user')->first();

        $email = $membership?->user?->email;

        if (! $email) {
            throw ValidationException::withMessages([
                'owner' => 'สนามนี้ยังไม่มีเจ้าของที่มีอีเมล',
            ]);
        }

        \Illuminate\Support\Facades\Password::sendResetLink(['email' => $email]);
        AdminAudit::record('ส่งลิงก์ตั้งรหัสผ่านให้เจ้าของสนาม', "{$org->name} · {$email}", $org->id);

        return response()->json(['message' => "ส่งลิงก์ตั้งรหัสผ่านไปที่ {$email} แล้ว", 'email' => $email]);
    }

    /**
     * PUT /admin/organizations/{id}/branches/{branchId}/sports
     *
     * Which sports a branch rents, set from the platform side.
     *
     * The venue's own portal can do this too — this exists for the admin
     * setting a customer up, or fixing one that got it wrong. It is not a small
     * field: it decides the loading screen and the notification icon in that
     * venue's app, which is exactly why it is worth an audit row. Changing what
     * someone else's customers see should leave a trace.
     *
     * Scoped to the branch and not the whole venue, because that is how the
     * data is stored and branches of one venue really do differ.
     */
    public function updateBranchSports(Request $request, string $id, string $branchId): AdminOrganizationDetailResource
    {
        $org = $this->find($id);

        $data = $request->validate([
            'sports' => ['present', 'array'],
            'sports.*' => ['string', Rule::exists('sports', 'key')],
        ]);

        $branch = \App\Models\Branch::query()
            ->where('organization_id', $org->id)
            ->where('id', $branchId)
            ->firstOrFail();

        $sports = array_values(array_unique($data['sports']));
        $branch->update(['sports' => $sports]);

        AdminAudit::record(
            'แก้ประเภทกีฬาของสนาม',
            "{$org->name} · {$branch->name} · ".(implode(', ', $sports) ?: 'ไม่ระบุ'),
            $org->id,
        );

        return new AdminOrganizationDetailResource($this->load($org->fresh()));
    }

    /** PUT /admin/organizations/{id}/plan — change the org's subscription plan. */
    public function changePlan(Request $request, string $id): AdminOrganizationDetailResource
    {
        $data = $request->validate([
            'planId' => ['required', 'string', Rule::exists('plans', 'id')],
        ]);

        $org = $this->find($id);
        $was = $this->renewals->currentSubscription($org)?->plan?->name;
        $plan = Plan::findOrFail($data['planId']);

        $this->renewals->changePlan($org, $plan);
        AdminAudit::record('เปลี่ยนแพ็กเกจ', trim(($was ? "{$was} → " : '').$plan->name), $org->id);

        return new AdminOrganizationDetailResource($this->load($org->fresh()));
    }

    /**
     * POST /admin/organizations/{id}/renew { months, markPaid, planId? }
     *
     * Renewal from the screen that shows the expiry date, because that is
     * where an admin is standing when they find out a venue is about to lapse.
     * It used to mean three screens: read the date here, raise the invoice on
     * the billing page, come back and approve it.
     *
     * `markPaid` is for money that arrived before the paperwork — a transfer
     * the venue phoned about, cash at a meeting. The invoice and the receipt
     * are still issued and the payment still lands in the platform ledger; it
     * just closes in one step instead of two. Without it an admin fixes the
     * expiry date by hand and that money never appears anywhere.
     *
     * An unpaid invoice already outstanding is used rather than a second one
     * raised beside it: two open invoices and one transfer is a puzzle nobody
     * can solve later.
     */
    public function renew(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'months' => ['required', 'integer', 'min:1', 'max:36'],
            'markPaid' => ['sometimes', 'boolean'],
            'planId' => ['sometimes', 'nullable', 'string', Rule::exists('plans', 'id')],
        ]);

        $org = $this->find($id);
        $plan = ! empty($data['planId']) ? Plan::find($data['planId']) : null;

        $existing = $this->renewals->outstandingInvoice($org);
        $invoice = $this->renewals->raiseInvoice($org, (int) $data['months'], 'admin', $plan);
        $reused = $existing !== null && $existing->id === $invoice->id;

        if ($data['markPaid'] ?? false) {
            $invoice = $this->renewals->approve($invoice, 'manual');
            AdminAudit::record(
                'ต่ออายุ (รับเงินแล้ว)',
                "{$data['months']} เดือน · ฿".number_format((float) $invoice->amount, 2)." · {$invoice->number}",
                $org->id,
            );
        } else {
            AdminAudit::record(
                $reused ? 'ออกใบแจ้งหนี้ (ใช้ใบที่ค้างอยู่)' : 'ออกใบแจ้งหนี้ต่ออายุ',
                "{$invoice->period_months} เดือน · ฿".number_format((float) $invoice->amount, 2)." · {$invoice->number}",
                $org->id,
            );
        }

        return response()->json([
            'data' => new AdminOrganizationDetailResource($this->load($org->fresh())),
            'invoice' => new AdminInvoiceResource($invoice->loadMissing('plan')),
            // The UI has to be able to say "this is the invoice you already
            // had" rather than implying it just billed them again.
            'reusedOutstanding' => $reused,
        ]);
    }

    /**
     * PUT /admin/organizations/{id}/expiry { endsAt, reason } — set the end
     * date by hand.
     *
     * The escape hatch for a date typed wrong or a deal agreed off the system.
     * It moves no money and issues no document, which is why the reason is
     * required and recorded: this is the one action that can hand a venue
     * months of service with nothing in the ledger to explain it.
     */
    public function setExpiry(Request $request, string $id): AdminOrganizationDetailResource
    {
        $data = $request->validate([
            'endsAt' => ['required', 'date'],
            'reason' => ['required', 'string', 'max:200'],
        ]);

        $org = $this->find($id);
        $sub = $this->renewals->currentSubscription($org);

        if (! $sub) {
            throw ValidationException::withMessages([
                'endsAt' => 'สนามนี้ยังไม่มีแพ็กเกจ กรุณาเลือกแพ็กเกจก่อน',
            ]);
        }

        $was = $sub->ends_at?->toDateString() ?? '—';
        $this->renewals->setEndsAt($sub, CarbonImmutable::parse($data['endsAt']));

        AdminAudit::record(
            'แก้วันหมดอายุด้วยมือ',
            "{$was} → ".CarbonImmutable::parse($data['endsAt'])->toDateString()." · เหตุผล: {$data['reason']}",
            $org->id,
        );

        return new AdminOrganizationDetailResource($this->load($org->fresh()));
    }

    /**
     * POST /admin/organizations/{id}/trial { planId, days } — start a free trial.
     *
     * The columns for this have been on the organisations table since the
     * first migration with nothing reading or writing them, so every venue
     * being shown the product was either given a real subscription or handled
     * outside the system.
     */
    public function startTrial(Request $request, string $id): AdminOrganizationDetailResource
    {
        $data = $request->validate([
            'planId' => ['required', 'string', Rule::exists('plans', 'id')],
            'days' => ['required', 'integer', 'min:1', 'max:90'],
        ]);

        $org = $this->find($id);
        $plan = Plan::findOrFail($data['planId']);

        $this->renewals->startTrial($org, $plan, (int) $data['days']);
        AdminAudit::record('เริ่มทดลองใช้', "{$plan->name} · {$data['days']} วัน", $org->id);

        return new AdminOrganizationDetailResource($this->load($org->fresh()));
    }

    /** DELETE /admin/organizations/{id} — soft-delete the organization. */
    public function destroy(string $id): JsonResponse
    {
        $org = $this->find($id);
        $org->delete();
        AdminAudit::record('ลบสนาม', $org->name, $org->id);

        return response()->json(null, 204);
    }

    /**
     * POST /admin/organizations/{id}/impersonate — issue an owner-portal token
     * for the org's owner so the super admin can act on their behalf.
     */
    public function impersonate(string $id): JsonResponse
    {
        $org = Organization::query()
            ->with(['organizationUsers.user', 'organizationUsers.role'])
            ->where('slug', $id)->orWhere('id', $id)
            ->firstOrFail();

        $membership = $org->organizationUsers->firstWhere(fn ($m) => $m->role?->code === 'owner')
            ?? $org->organizationUsers->first();
        $user = $membership?->user;

        if (! $user) {
            throw ValidationException::withMessages(['owner' => 'องค์กรนี้ยังไม่มีเจ้าของให้สวมสิทธิ์']);
        }

        $token = $user->createToken('impersonate-token')->plainTextToken;

        // The entry that matters most on this page: for a stretch afterwards,
        // anything done in that venue's portal was done by a platform admin
        // wearing the owner's face, and only this row says so.
        AdminAudit::record('สวมสิทธิ์เจ้าของสนาม', "{$org->name} · ในนาม {$user->email}", $org->id);

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user),
        ]);
    }

    private function find(string $id): Organization
    {
        return Organization::query()->where('slug', $id)->orWhere('id', $id)->firstOrFail();
    }

    private function load(Organization $org): Organization
    {
        return $org->load([
            'activeSubscription.plan',
            'settings',
            'organizationUsers.user',
            'organizationUsers.role',
            // Ordered so the drawer's list does not reshuffle between saves.
            'branches' => fn ($q) => $q->orderBy('created_at'),
        ])->loadCount(['branches', 'courts', 'customers']);
    }
}
