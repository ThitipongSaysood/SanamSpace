<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // In-app notifications (frontend AppNotification). customer_id is
        // nullable to allow org-wide broadcasts. `time_ago` is stored as a
        // pre-formatted Thai label so it matches the fixtures exactly.
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('customer_id')->nullable();
            $table->string('kind'); // booking | reminder | promo | points
            $table->string('title');
            $table->text('body');
            $table->string('time_ago'); // e.g. "เมื่อสักครู่", "1 ชั่วโมงที่แล้ว"
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
