<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Makes invoices and receipts real documents.
 *
 * Until now a "receipt" was the invoice number with INV swapped for RCP at
 * render time — nothing was recorded, so two people could see different numbers
 * and a reissue left no trace. A receipt now gets its own stored number and
 * date, issued once when the money is confirmed.
 *
 * Tax: plan prices are VAT-INCLUSIVE, so the tax is backed out of the total
 * rather than added to it. Both the split and the rate are stored per invoice —
 * a later rate change must not silently rewrite documents already issued.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            // Snapshot of the money split at issue time. vat_rate 0 = not taxed.
            $table->decimal('subtotal', 12, 2)->default(0)->after('amount');
            $table->decimal('vat_amount', 12, 2)->default(0)->after('subtotal');
            $table->decimal('vat_rate', 5, 2)->default(0)->after('vat_amount');

            // Issued once, when payment is confirmed.
            $table->string('receipt_number')->nullable()->unique()->after('number');
            $table->string('receipt_date')->nullable()->after('paid_date');
        });

        // The seller's identity on the document.
        Schema::table('platform_settings', function (Blueprint $table) {
            $table->string('company_name')->nullable();
            $table->string('tax_id', 20)->nullable();
            $table->text('company_address')->nullable();
            $table->boolean('vat_enabled')->default(false);
            $table->decimal('vat_rate', 5, 2)->default(7);
        });

        // The buyer's identity. A venue that wants a tax invoice has to give a
        // tax id and the head-office/branch it belongs to.
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->string('tax_id', 20)->nullable();
            $table->string('billing_name')->nullable();
            $table->text('billing_address')->nullable();
            $table->string('billing_branch', 100)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropUnique(['receipt_number']);
            $table->dropColumn(['subtotal', 'vat_amount', 'vat_rate', 'receipt_number', 'receipt_date']);
        });

        Schema::table('platform_settings', function (Blueprint $table) {
            $table->dropColumn(['company_name', 'tax_id', 'company_address', 'vat_enabled', 'vat_rate']);
        });

        Schema::table('organization_settings', function (Blueprint $table) {
            $table->dropColumn(['tax_id', 'billing_name', 'billing_address', 'billing_branch']);
        });
    }
};
