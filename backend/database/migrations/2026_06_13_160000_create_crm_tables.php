<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // --- Customer segments (CRM): named groups of customers per org ---
        Schema::create('customer_segments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->string('name');
            $table->text('description')->nullable();
            $table->json('criteria')->nullable(); // optional rule definition (unused by MVP)
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
        });

        // --- Segment membership pivot (UUID pk so syncs generate one, like plan_features) ---
        Schema::create('customer_segment_members', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('segment_id');
            $table->uuid('customer_id');
            $table->timestamps();

            $table->foreign('segment_id')->references('id')->on('customer_segments')->cascadeOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
            $table->unique(['segment_id', 'customer_id']);
        });

        // --- Customer timeline: per-customer activity feed ---
        Schema::create('customer_timeline', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('customer_id');
            $table->string('type', 50); // signup | booking | payment | points | note
            $table->string('title');
            $table->text('description')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
            $table->index(['customer_id', 'occurred_at']);
        });

        // --- Broadcasts: marketing messages to a segment (or whole org) ---
        Schema::create('broadcasts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->string('title');
            $table->text('message');
            $table->string('channel', 50); // line | email | sms | push
            $table->uuid('segment_id')->nullable();
            $table->string('status', 50)->default('draft'); // draft | sent
            $table->unsignedInteger('recipient_count')->default(0);
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('segment_id')->references('id')->on('customer_segments')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('broadcasts');
        Schema::dropIfExists('customer_timeline');
        Schema::dropIfExists('customer_segment_members');
        Schema::dropIfExists('customer_segments');
    }
};
