<?php

use App\Models\Invoice;
use App\Models\Organization;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Turns `invoices` from an admin display table into the real document behind a
 * subscription renewal.
 *
 * It was seeded demo data: the org was a free-text name, dates were display
 * strings, and nothing tied a row to the subscription it paid for. A venue now
 * renews by transferring money against one of these, so a row has to name a
 * real organization, the plan and period it buys, and carry the slip through
 * review.
 *
 * The old display columns (organization_name, issue_date, due_date, paid_date)
 * are kept so the existing Super Admin billing screen keeps working unchanged.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            // Nullable: the seeded demo rows name orgs that do not exist.
            $table->uuid('organization_id')->nullable()->after('id');
            $table->uuid('plan_id')->nullable()->after('organization_id');
            $table->unsignedSmallInteger('period_months')->default(1)->after('amount');

            // Who raised it: the venue renewing itself, or the platform billing them.
            $table->string('source', 20)->default('admin')->after('period_months');

            // status: unpaid | pending_review | paid | overdue | rejected
            $table->string('slip_url', 2000)->nullable()->after('paid_date');
            $table->string('slip_path', 500)->nullable()->after('slip_url');
            $table->timestamp('slip_uploaded_at')->nullable()->after('slip_path');
            $table->string('reject_reason', 500)->nullable()->after('slip_uploaded_at');
            // The real timestamp; `paid_date` stays a display string for the UI.
            $table->timestamp('paid_at')->nullable()->after('reject_reason');

            $table->foreign('organization_id')->references('id')->on('organizations')->nullOnDelete();
            $table->foreign('plan_id')->references('id')->on('plans')->nullOnDelete();
            $table->index(['organization_id', 'status']);
        });

        // Best-effort backfill so existing rows point at a real org where the
        // name still matches. Unmatched rows simply keep a null organization_id.
        $byName = Organization::query()->pluck('id', 'name');
        foreach (Invoice::query()->whereNull('organization_id')->get() as $invoice) {
            if ($id = $byName[$invoice->organization_name] ?? null) {
                $invoice->forceFill(['organization_id' => $id])->save();
            }
        }

        // The platform already stores where it receives money (promptpay_id +
        // bank_*); only the PromptPay display name was missing, and a venue
        // transferring needs to see who it is paying.
        Schema::table('platform_settings', function (Blueprint $table) {
            $table->string('promptpay_name')->nullable()->after('promptpay_id');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropForeign(['organization_id']);
            $table->dropForeign(['plan_id']);
            $table->dropIndex(['organization_id', 'status']);
            $table->dropColumn([
                'organization_id', 'plan_id', 'period_months', 'source',
                'slip_url', 'slip_path', 'slip_uploaded_at', 'reject_reason', 'paid_at',
            ]);
        });

        Schema::table('platform_settings', function (Blueprint $table) {
            $table->dropColumn('promptpay_name');
        });
    }
};
