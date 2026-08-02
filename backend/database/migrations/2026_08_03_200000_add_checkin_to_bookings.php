<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Real check-in, replacing the placeholder.
 *
 * What was there: a decorative grid of squares that no scanner could read, a
 * hard-coded "00:15:32" countdown, and a button that let the CUSTOMER mark
 * their own booking complete.
 *
 * `checkin_token` is what the QR actually encodes. It is not the booking code:
 * codes are short and sequential enough to type at random, and anyone who
 * guessed one could check in a stranger's booking. `checked_in_at` records when
 * it happened, which is what makes no-show reporting possible later.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('checkin_token', 64)->nullable()->unique()->after('code');
            $table->timestamp('checked_in_at')->nullable()->after('status');
        });

        // Existing bookings need a token too, or their QR screen would be blank.
        foreach (DB::table('bookings')->whereNull('checkin_token')->pluck('id') as $id) {
            DB::table('bookings')->where('id', $id)->update([
                'checkin_token' => Str::lower(Str::random(32)),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['checkin_token', 'checked_in_at']);
        });
    }
};
