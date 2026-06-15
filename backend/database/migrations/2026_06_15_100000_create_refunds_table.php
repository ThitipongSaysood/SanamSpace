<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('refunds', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('booking_id');
            $table->uuid('payment_id')->nullable();
            $table->uuid('customer_id');
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('reason')->nullable();
            $table->string('status', 50)->default('requested');   // requested|approved|rejected
            $table->string('method', 50)->default('wallet');       // refund destination (wallet credit)
            $table->string('requested_by', 50)->default('customer'); // customer|owner|admin
            $table->uuid('processed_by')->nullable();              // users.id who approved/rejected
            $table->timestamp('processed_at')->nullable();
            $table->string('note')->nullable();                    // owner/admin note on approve/reject
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('booking_id')->references('id')->on('bookings')->cascadeOnDelete();
            $table->foreign('payment_id')->references('id')->on('payments')->nullOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();

            $table->index(['booking_id']);
            $table->index(['organization_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refunds');
    }
};
