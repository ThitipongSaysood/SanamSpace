<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Register the `slip_auto_verify` feature and grant it to Business + Pro, the
 * same way real_plan_feature_catalogue seeded the rest. Kept idempotent so it is
 * safe on a database that already has the row.
 */
return new class extends Migration
{
    private const CODE = 'slip_auto_verify';

    public function up(): void
    {
        $featureId = DB::table('features')->where('code', self::CODE)->value('id');

        if (! $featureId) {
            $featureId = (string) Str::uuid();
            DB::table('features')->insert([
                'id' => $featureId,
                'code' => self::CODE,
                'name' => 'ตรวจสลิปอัตโนมัติ',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::table('plan_features')->where('feature_id', $featureId)->delete();

        foreach (DB::table('plans')->whereIn('code', ['business', 'pro'])->pluck('id') as $planId) {
            DB::table('plan_features')->insert([
                'id' => (string) Str::uuid(),
                'plan_id' => $planId,
                'feature_id' => $featureId,
                'enabled' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        $featureId = DB::table('features')->where('code', self::CODE)->value('id');
        if ($featureId) {
            DB::table('plan_features')->where('feature_id', $featureId)->delete();
            DB::table('features')->where('id', $featureId)->delete();
        }
    }
};
