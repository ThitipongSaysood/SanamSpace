<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('branch_id');
            $table->uuid('court_id');
            $table->uuid('customer_id');
            $table->string('code')->unique();
            $table->date('date');
            $table->string('start', 5);   // "18:00"
            $table->string('end', 5);     // "19:00"
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('status', 50)->default('pending_payment');
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('branch_id')->references('id')->on('branches')->cascadeOnDelete();
            $table->foreign('court_id')->references('id')->on('courts')->cascadeOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();

            // Speeds up overlap checks and the customer's booking list.
            $table->index(['court_id', 'date']);
            $table->index(['customer_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
