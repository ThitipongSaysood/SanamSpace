<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Discounts: a code the customer types, and a standing rate for members.
 *
 * The pricing line in BookingController carried `// TODO: member discount /
 * coupons` since the first commit, so every booking was full price no matter
 * who was booking it.
 *
 * `coupon_redemptions` exists because a usage limit that is only a counter
 * cannot answer "has THIS customer used it", which is the limit venues
 * actually want. It is also the record that makes a discount auditable — a
 * booking that came out cheaper should be able to say why.
 *
 * The discount is snapshotted onto the booking (`discount_amount`,
 * `discount_label`) for the same reason rental lines are: editing or retiring a
 * coupon must not rewrite what someone was charged last month.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coupons', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            // Stored uppercase; compared uppercase. "sanam10" and "SANAM10"
            // are the same code to everyone except a database.
            $table->string('code', 40);
            $table->string('description')->nullable();
            $table->string('type', 10)->default('percent'); // percent | fixed
            $table->decimal('value', 10, 2);
            // Guards against a 50%-off code being used on a ฿120 booking when
            // the venue meant it for weekend packages.
            $table->decimal('min_amount', 10, 2)->default(0);
            $table->decimal('max_discount', 10, 2)->nullable();
            $table->unsignedInteger('usage_limit')->nullable();      // total, all customers
            $table->unsignedInteger('per_customer_limit')->default(1);
            $table->unsignedInteger('used_count')->default(0);
            $table->date('starts_at')->nullable();
            $table->date('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            // One code per venue. Two venues may both run "OPEN50".
            $table->unique(['organization_id', 'code']);
        });

        Schema::create('coupon_redemptions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('coupon_id');
            $table->uuid('customer_id')->nullable();
            $table->uuid('booking_id')->nullable();
            $table->decimal('amount', 10, 2);
            $table->timestamps();

            $table->foreign('coupon_id')->references('id')->on('coupons')->cascadeOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->nullOnDelete();
            $table->foreign('booking_id')->references('id')->on('bookings')->nullOnDelete();
            // "How many times has this person used this code" — the per-customer
            // limit, which a bare counter cannot answer.
            $table->index(['coupon_id', 'customer_id']);
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->decimal('discount_amount', 10, 2)->default(0)->after('rental_total');
            // What to show on the receipt: "คูปอง SANAM10" or "ส่วนลดสมาชิก Gold".
            $table->string('discount_label')->nullable()->after('discount_amount');
            $table->uuid('coupon_id')->nullable()->after('discount_label');
        });

        // A standing rate per membership tier, kept with the venue's settings
        // because it is a pricing rule rather than a campaign.
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->json('member_discounts')->nullable()->after('deposit_value');
        });
    }

    public function down(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->dropColumn('member_discounts');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['discount_amount', 'discount_label', 'coupon_id']);
        });

        Schema::dropIfExists('coupon_redemptions');
        Schema::dropIfExists('coupons');
    }
};
