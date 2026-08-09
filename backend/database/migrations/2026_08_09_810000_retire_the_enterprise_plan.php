<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Retire the Enterprise plan.
 *
 * It was priced at ฿0, had no subscribers and no invoices, and the only thing
 * it offered above Pro was a white-label custom domain that has never been
 * built. A fourth column on the pricing page that sold nothing and could not be
 * delivered.
 *
 * **Deactivated, not deleted.** Subscriptions and invoices reference plans by
 * id; deleting the row would orphan any history that appears later — and a
 * pricing decision must not be able to corrupt a ledger. Anyone still on it is
 * moved to Pro first, which is what they had in practice.
 */
return new class extends Migration
{
    public function up(): void
    {
        $enterprise = DB::table('plans')->where('code', 'enterprise')->first();

        if (! $enterprise) {
            return;
        }

        $pro = DB::table('plans')->where('code', 'pro')->first();

        // Nobody is expected to be here, but moving them is the difference
        // between a tidy-up and a venue losing its features overnight.
        if ($pro) {
            DB::table('subscriptions')->where('plan_id', $enterprise->id)->update([
                'plan_id' => $pro->id,
                'updated_at' => now(),
            ]);
        }

        DB::table('plan_features')->where('plan_id', $enterprise->id)->delete();
        DB::table('plans')->where('id', $enterprise->id)->update([
            'is_active' => false,
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('plans')->where('code', 'enterprise')->update([
            'is_active' => true,
            'updated_at' => now(),
        ]);
    }
};
