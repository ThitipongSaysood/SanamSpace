<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who a broadcast actually reached, kept.
 *
 * Sending computed a `delivery` block — sent, failed, skipped — showed it once
 * in the response and threw it away. Reopening the broadcast a minute later
 * showed only `recipient_count`, so "did that promo go out?" had no answer, and
 * neither did "who did we already message".
 *
 * `broadcast_recipients` is one row per customer per send: it is what makes
 * per-customer attribution possible later, and it is the audit trail a PDPA
 * question about marketing needs.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('broadcast_recipients', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('broadcast_id');
            $table->uuid('customer_id')->nullable();
            // sent: the provider accepted it. skipped: no LINE profile to send
            // to. failed: the provider refused. Distinguishing skipped from
            // failed is the difference between "we cannot reach them" and
            // "something is broken".
            $table->string('status', 20);
            $table->string('reason', 255)->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->foreign('broadcast_id')->references('id')->on('broadcasts')->cascadeOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->nullOnDelete();
            $table->index(['broadcast_id', 'status']);
            // "Which broadcasts has this customer had" — the attribution query.
            $table->index(['customer_id', 'sent_at']);
        });

        Schema::table('broadcasts', function (Blueprint $table) {
            // Who pressed send. A marketing message going out is an action with
            // an author, and "who sent this" had no answer at all.
            $table->uuid('sent_by')->nullable()->after('sent_at');
            $table->json('delivery_stats')->nullable()->after('sent_by');
        });
    }

    public function down(): void
    {
        Schema::table('broadcasts', function (Blueprint $table) {
            $table->dropColumn(['sent_by', 'delivery_stats']);
        });

        Schema::dropIfExists('broadcast_recipients');
    }
};
