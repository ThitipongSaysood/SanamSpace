<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_packages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('customer_id');
            $table->uuid('venue_package_id')->nullable(); // source package (snapshot kept below)
            $table->string('name');
            $table->decimal('total_hours', 6, 2);
            $table->decimal('remaining_hours', 6, 2);
            $table->decimal('price', 12, 2)->default(0);
            $table->unsignedInteger('valid_days')->default(0);
            $table->string('status', 20)->default('pending'); // pending|pending_review|active|rejected|expired
            $table->string('slip_url')->nullable();
            $table->date('expires_at')->nullable(); // set when activated = today + valid_days
            $table->timestamps();
            $table->softDeletes();

            $table->index(['customer_id', 'status']);
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_packages');
    }
};
