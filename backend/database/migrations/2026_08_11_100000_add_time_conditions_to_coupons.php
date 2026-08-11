<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When a coupon may be used — as data, not as words in its description.
 *
 * A venue running "จอง 07:00–16:00 ลด 10%" had nowhere to put the 07:00–16:00.
 * The condition lived in the promotion's title, where nothing could read it, so
 * the code came off a 20:00 peak-hour booking exactly as happily as an empty
 * Tuesday morning. The venue was giving away its busiest hours and only the
 * customer knew.
 *
 * Times are the VENUE's wall clock, matching `bookings.start` / `.end`, which
 * are stored the same way. Storing them as UTC instants would be wrong twice:
 * the venue means "seven in the morning here", and a booking row has no
 * timezone to compare against.
 *
 * All three are nullable, and null means "no restriction" — an existing coupon
 * keeps working exactly as it did the day before this ran.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('coupons', function (Blueprint $table) {
            // Stored as HH:MM strings rather than TIME, for the same reason
            // bookings do: SQLite and MySQL disagree about what comes back out
            // of a TIME column, and every comparison here is a string compare
            // against a booking row that is already a string.
            $table->string('valid_from_time', 5)->nullable()->after('ends_at');
            $table->string('valid_to_time', 5)->nullable()->after('valid_from_time');
            // ISO-8601 weekdays (1 = Monday … 7 = Sunday). Null = every day.
            $table->json('valid_days')->nullable()->after('valid_to_time');
        });
    }

    public function down(): void
    {
        Schema::table('coupons', function (Blueprint $table) {
            $table->dropColumn(['valid_from_time', 'valid_to_time', 'valid_days']);
        });
    }
};
