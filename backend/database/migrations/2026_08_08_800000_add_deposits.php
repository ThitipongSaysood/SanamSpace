<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Deposits: hold the slot for part of the money, collect the rest later.
 *
 * Until now a booking was paid in full or not paid at all, which is not how a
 * court actually gets held — venues take a deposit to stop no-shows and take
 * the balance at the counter.
 *
 * `paid_amount` is the running total of approved payments and is the single
 * source of truth for what is still owed. Deriving it by summing payments at
 * read time was the alternative; a stored column is what lets a booking say
 * "฿100 left" without every screen knowing the payment table.
 *
 * `deposit_amount` is a snapshot taken when the booking is made, not read from
 * settings later: changing the venue's deposit rule must not silently change
 * what an existing customer was told to pay.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->boolean('deposit_enabled')->default(false)->after('checkin_enabled');
            // percent: a share of the booking. fixed: the same baht every time.
            $table->string('deposit_type', 10)->default('percent')->after('deposit_enabled');
            $table->decimal('deposit_value', 10, 2)->default(0)->after('deposit_type');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->decimal('deposit_amount', 10, 2)->default(0)->after('rental_total');
            $table->decimal('paid_amount', 10, 2)->default(0)->after('deposit_amount');
        });

        // Existing confirmed/completed bookings were paid in full — that is what
        // confirmed meant before deposits existed. Without this they would all
        // read as owing their whole amount.
        DB::table('bookings')
            ->whereIn('status', ['confirmed', 'completed'])
            ->update(['paid_amount' => DB::raw('amount')]);
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['deposit_amount', 'paid_amount']);
        });

        Schema::table('organization_settings', function (Blueprint $table) {
            $table->dropColumn(['deposit_enabled', 'deposit_type', 'deposit_value']);
        });
    }
};
