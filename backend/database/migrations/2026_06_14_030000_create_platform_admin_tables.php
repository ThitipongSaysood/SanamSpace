<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Platform Admin (Super Admin) domains: invoices, transactions, support
 * tickets, announcements, audit logs, platform settings. Organization is
 * stored denormalized (name) — these are read-mostly platform views.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('number')->unique();
            $table->string('organization_name');
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('status', 30)->default('unpaid'); // paid|unpaid|overdue
            $table->string('issue_date'); // display date
            $table->string('due_date');
            $table->timestamps();
        });

        Schema::create('platform_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('organization_name');
            $table->string('type', 50)->default('subscription'); // subscription|topup|refund
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('method', 50)->default('card');
            $table->string('status', 30)->default('success'); // success|pending|failed|refunded
            $table->timestamps();
        });

        Schema::create('support_tickets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('ticket_no')->unique();
            $table->string('organization_name');
            $table->string('subject');
            $table->string('status', 30)->default('open'); // open|in_progress|resolved|closed
            $table->string('priority', 20)->default('medium'); // low|medium|high
            $table->string('assigned_to')->nullable();
            $table->timestamps();
        });

        Schema::create('announcements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->text('body')->nullable();
            $table->string('audience', 50)->default('all'); // all|trial|paid
            $table->string('status', 20)->default('draft'); // draft|published
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('user_name');
            $table->string('action');
            $table->string('detail')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();
        });

        Schema::create('platform_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('platform_name')->default('SanamSpace');
            $table->string('support_email')->nullable();
            $table->string('timezone', 100)->default('Asia/Bangkok');
            $table->string('currency', 10)->default('THB');
            $table->string('date_format', 30)->default('DD/MM/YYYY');
            $table->string('language', 10)->default('th');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_settings');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('announcements');
        Schema::dropIfExists('support_tickets');
        Schema::dropIfExists('platform_transactions');
        Schema::dropIfExists('invoices');
    }
};
