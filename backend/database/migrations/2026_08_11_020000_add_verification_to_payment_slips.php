<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_slips', function (Blueprint $table) {
            // Denormalised so a duplicate check can be scoped to the venue
            // without joining through payments on every upload.
            $table->uuid('organization_id')->nullable()->after('payment_id');
            // Phase 0 — catch a re-used slip: the exact file (sha256) and the
            // bank transaction reference decoded from the slip's QR (survives a
            // re-saved image, where the hash would change).
            $table->string('sha256', 64)->nullable()->after('url');
            $table->text('qr_payload')->nullable()->after('sha256');
            $table->string('trans_ref')->nullable()->after('qr_payload');
            $table->timestamp('trans_date')->nullable()->after('trans_ref');
            // Phase 1 — filled by a slip-verification provider (SlipOK/EasySlip).
            $table->decimal('verified_amount', 12, 2)->nullable()->after('trans_date');
            $table->string('sender_name')->nullable()->after('verified_amount');
            $table->string('receiver_ref')->nullable()->after('sender_name');
            // unchecked | verified | failed | duplicate | manual
            $table->string('verify_status', 20)->default('unchecked')->after('receiver_ref');
            // manual | hash | qr | slipok | easyslip
            $table->string('verify_source', 20)->default('manual')->after('verify_status');
            $table->json('verify_payload')->nullable()->after('verify_source');

            $table->index(['organization_id', 'sha256']);
            $table->index(['organization_id', 'trans_ref']);
        });
    }

    public function down(): void
    {
        Schema::table('payment_slips', function (Blueprint $table) {
            $table->dropIndex(['organization_id', 'sha256']);
            $table->dropIndex(['organization_id', 'trans_ref']);
            $table->dropColumn([
                'organization_id', 'sha256', 'qr_payload', 'trans_ref', 'trans_date',
                'verified_amount', 'sender_name', 'receiver_ref', 'verify_status',
                'verify_source', 'verify_payload',
            ]);
        });
    }
};
