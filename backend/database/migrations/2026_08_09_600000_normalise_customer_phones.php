<?php

use App\Support\ThaiPhone;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A phone number the database can actually compare.
 *
 * `phone` holds whatever was typed — "081-234-5678", "+66 81 234 5678",
 * "0812345678" — so no query can tell that those are one person. That is how a
 * regular customer becomes three rows: staff book them as a walk-in each visit,
 * and nothing has ever looked for the row that already exists.
 *
 * The normalised column is what matching and duplicate-detection read. It is
 * NOT unique: duplicates already exist and must stay visible until someone
 * merges them deliberately — a unique index here would fail the migration on
 * exactly the venues that need it most.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->string('phone_normalized', 20)->nullable()->after('phone');
            $table->index(['organization_id', 'phone_normalized']);
        });

        DB::table('customers')
            ->whereNotNull('phone')
            ->orderBy('id')
            ->chunkById(500, function ($rows) {
                foreach ($rows as $row) {
                    $normalized = ThaiPhone::normalize($row->phone);

                    if ($normalized !== null) {
                        DB::table('customers')->where('id', $row->id)->update(['phone_normalized' => $normalized]);
                    }
                }
            });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropIndex(['organization_id', 'phone_normalized']);
            $table->dropColumn('phone_normalized');
        });
    }
};
