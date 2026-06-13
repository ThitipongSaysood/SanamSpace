<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_slips', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('payment_id');
            $table->string('file_path');
            $table->string('url');
            $table->string('original_name')->nullable();
            $table->timestamp('uploaded_at')->nullable();
            $table->timestamps();

            $table->foreign('payment_id')->references('id')->on('payments')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_slips');
    }
};
