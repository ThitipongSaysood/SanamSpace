<?php

use App\Support\PlanCatalogue;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Make the plan catalogue describe the product that exists.
 *
 * Two problems, and the second is the reason for the first.
 *
 * 1. Four of the nine features — tournament, public_api, custom_domain,
 *    payment_gateway — have no code anywhere. They sit on the pricing table as
 *    things a venue is paying for.
 * 2. Almost everything the product actually does was missing: the POS, rental
 *    equipment, points and rewards, coupons, reports, multi-branch. Fifteen
 *    capabilities with no entry, and therefore no plan could gate them.
 *
 * Nothing enforced any of it, so none of this showed. A Starter venue at ฿990
 * had exactly what an Enterprise venue had. This migration writes the real
 * catalogue; the middleware added alongside it is what makes the catalogue mean
 * something.
 *
 * The three unbuilt features are removed rather than left unticked: a row that
 * says "Enterprise only" for something nobody can build is a promise. Add them
 * back when they exist. `payment_gateway` stays — slip verification IS the
 * payment path today — renamed to say what it is.
 */
return new class extends Migration
{
    /** Sold, never built. Removed rather than left as an unkept promise. */
    private const NEVER_BUILT = ['tournament', 'public_api', 'custom_domain'];

    public function up(): void
    {
        // Slip verification is the payment path today; the name said otherwise.
        DB::table('features')->where('code', 'payment_gateway')->update([
            'code' => 'payment_verify',
            'name' => 'ตรวจสลิป/ยืนยันการชำระเงิน',
            'updated_at' => now(),
        ]);
        // …and it is core: taking money is not an upsell.
        $this->detach('payment_verify');

        foreach (self::NEVER_BUILT as $code) {
            $this->detach($code);
            DB::table('features')->where('code', $code)->delete();
        }
        DB::table('features')->where('code', 'payment_verify')->delete();

        $planIds = DB::table('plans')->pluck('id', 'code');

        foreach (PlanCatalogue::FEATURES as $code => [$name, $planCodes]) {
            $featureId = DB::table('features')->where('code', $code)->value('id');

            if ($featureId) {
                DB::table('features')->where('id', $featureId)->update(['name' => $name, 'updated_at' => now()]);
            } else {
                $featureId = (string) Str::uuid();
                DB::table('features')->insert([
                    'id' => $featureId,
                    'code' => $code,
                    'name' => $name,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            // Rewritten rather than merged: this migration is the statement of
            // what each plan includes, and half-applying it would leave a venue
            // with an entitlement nobody chose.
            DB::table('plan_features')->where('feature_id', $featureId)->delete();

            foreach ($planCodes as $planCode) {
                if (! isset($planIds[$planCode])) {
                    continue;
                }

                DB::table('plan_features')->insert([
                    'id' => (string) Str::uuid(),
                    'plan_id' => $planIds[$planCode],
                    'feature_id' => $featureId,
                    'enabled' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        foreach (PlanCatalogue::codes() as $code) {
            if (in_array($code, ['wallet', 'package', 'membership', 'crm', 'broadcast'], true)) {
                continue; // these existed before
            }

            $id = DB::table('features')->where('code', $code)->value('id');

            if ($id) {
                DB::table('plan_features')->where('feature_id', $id)->delete();
                DB::table('features')->where('id', $id)->delete();
            }
        }
    }

    private function detach(string $code): void
    {
        $id = DB::table('features')->where('code', $code)->value('id');

        if ($id) {
            DB::table('plan_features')->where('feature_id', $id)->delete();
        }
    }
};
