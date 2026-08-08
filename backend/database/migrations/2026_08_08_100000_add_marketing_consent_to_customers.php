<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PDPA: whether this customer agreed to marketing, and whether they have opted
 * out since.
 *
 * Two separate facts, deliberately not one flag:
 *
 * - `marketing_consent` is **nullable on purpose**. `null` means nobody ever
 *   asked — which is the truth for every customer created before today, and is
 *   different from "asked and said no" (`false`). Backfilling them all to true
 *   would be inventing a consent that was never given; backfilling to false
 *   would claim they refused.
 * - `unsubscribed_at` is the opt-out, and it is the one the broadcast audience
 *   filters on. It is a timestamp rather than a boolean because "when did they
 *   opt out" is the question a compliance request actually asks.
 *
 * Re-subscribing clears `unsubscribed_at`; the consent answer is kept, so a
 * venue can tell "opted out" from "never consented".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->boolean('marketing_consent')->nullable()->after('email');
            $table->timestamp('consent_at')->nullable()->after('marketing_consent');
            $table->timestamp('unsubscribed_at')->nullable()->after('consent_at');

            // Every broadcast asks the same question: who in this venue may
            // still be marketed to.
            $table->index(['organization_id', 'unsubscribed_at']);
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropIndex(['organization_id', 'unsubscribed_at']);
            $table->dropColumn(['marketing_consent', 'consent_at', 'unsubscribed_at']);
        });
    }
};
