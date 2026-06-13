<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One membership per customer (frontend Membership). Benefits are
        // folded in as a JSON list to keep the schema pragmatic.
        Schema::create('memberships', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('customer_id');
            $table->string('tier'); // Silver | Gold | Platinum
            $table->string('member_id'); // e.g. ED-0001234
            $table->unsignedInteger('points')->default(0);
            $table->string('expires_at'); // pre-formatted Thai display date, e.g. "31 ธ.ค. 2567"
            $table->json('benefits')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
            $table->unique('customer_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('memberships');
    }
};
