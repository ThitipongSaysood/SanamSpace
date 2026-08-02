<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Gives support tickets a conversation and a resolution.
 *
 * The Super Admin could only ever read tickets: no way to answer one, and no
 * way to mark it done, so the queue only ever grew. A reply is recorded here
 * AND emailed to the venue — the venue has no support inbox of its own, so an
 * answer that only lives in the admin portal never reaches anyone.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_ticket_replies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('support_ticket_id');
            $table->string('author_name');
            // 'platform' (us) or 'organization' (them) — the thread shows both sides.
            $table->string('author_side', 20)->default('platform');
            $table->text('body');
            // Whether this reply actually made it out to the venue.
            $table->boolean('emailed')->default(false);
            $table->timestamps();

            $table->foreign('support_ticket_id')->references('id')->on('support_tickets')->cascadeOnDelete();
            $table->index('support_ticket_id');
        });

        Schema::table('support_tickets', function (Blueprint $table) {
            // The original message. Seeded rows only ever had a subject.
            $table->text('body')->nullable()->after('subject');
            $table->timestamp('resolved_at')->nullable()->after('assigned_to');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_ticket_replies');

        Schema::table('support_tickets', function (Blueprint $table) {
            $table->dropColumn(['body', 'resolved_at']);
        });
    }
};
