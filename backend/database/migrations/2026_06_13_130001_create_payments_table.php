<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('booking_id');
            $table->uuid('customer_id');
            $table->string('method', 50);  // promptpay|transfer|wallet|card
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('status', 50)->default('awaiting_slip'); // awaiting_slip|pending_review|approved|rejected
            $table->string('slip_url')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('booking_id')->references('id')->on('bookings')->cascadeOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();

            $table->index(['booking_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
