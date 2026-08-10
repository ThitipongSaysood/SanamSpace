<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Free-text notes staff attach to a customer (CRM). Until now there was
        // no way to record "asked for court 3", "prefers evenings", "no-showed
        // twice" — the timeline `note` type existed and was written by nothing.
        Schema::create('customer_notes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('customer_id');
            $table->uuid('author_id')->nullable(); // the staff user who wrote it
            $table->text('body');
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
            $table->foreign('author_id')->references('id')->on('users')->nullOnDelete();
            $table->index(['customer_id', 'created_at']);
        });

        // A follow-up the venue owes a customer: call back, chase a deposit,
        // win a churned regular back.
        Schema::create('customer_tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('customer_id');
            $table->string('title');
            $table->date('due_at')->nullable();
            $table->uuid('assigned_to')->nullable();  // staff user responsible
            $table->uuid('created_by')->nullable();
            $table->string('status', 20)->default('open'); // open | done
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
            $table->foreign('assigned_to')->references('id')->on('users')->nullOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['customer_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_tasks');
        Schema::dropIfExists('customer_notes');
    }
};
