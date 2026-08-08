<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which package paid for this booking's court time.
 *
 * Redeeming a package used to be inferred from the booking landing on
 * `confirmed` with a zero amount. That stopped working once a package could
 * cover the court while rented equipment was still owed: the booking stays
 * `pending_payment`, and without a record of the redemption a second package
 * could be spent on the same court hour.
 *
 * Nullable and unconstrained-on-delete: a deleted package must not take the
 * booking's history with it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->uuid('customer_package_id')->nullable()->after('rental_total');
            $table->timestamp('package_redeemed_at')->nullable()->after('customer_package_id');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['customer_package_id', 'package_redeemed_at']);
        });
    }
};
