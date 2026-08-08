<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Did the racket come back?
 *
 * Renting recorded what went out and never recorded what came in, so the venue
 * had no way to answer "who still has our gear" — the one question that costs
 * money when the answer is nobody knows.
 *
 * `returned_qty` rather than a boolean because two rackets can go out and one
 * come back, and a counter that cannot record a partial return will record
 * nothing at all.
 *
 * This is deliberately NOT an input to availability. Availability is a question
 * about a time window — the booking holds those rackets for its hours whether
 * or not they are physically on the shelf — so returning early must not hand
 * them to an overlapping booking.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_rentals', function (Blueprint $table) {
            $table->unsignedInteger('returned_qty')->default(0)->after('quantity');
            $table->timestamp('returned_at')->nullable()->after('returned_qty');
        });
    }

    public function down(): void
    {
        Schema::table('booking_rentals', function (Blueprint $table) {
            $table->dropColumn(['returned_qty', 'returned_at']);
        });
    }
};
