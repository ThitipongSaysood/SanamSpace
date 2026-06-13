<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Sample customer reviews shown in a branch's ReviewSummary.reviews[].
        Schema::create('reviews', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->uuid('branch_id');
            $table->string('author');
            $table->unsignedTinyInteger('rating'); // 1..5
            $table->string('review_date'); // pre-formatted Thai display date, e.g. "25 เม.ย. 2567"
            $table->text('text');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('branch_id')->references('id')->on('branches')->cascadeOnDelete();
        });

        // The aggregate rating breakdown lives on branches alongside the
        // existing rating / review_count (reused for ReviewSummary.average/total).
        Schema::table('branches', function (Blueprint $table) {
            $table->json('rating_breakdown')->nullable()->after('review_count');
        });
    }

    public function down(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->dropColumn('rating_breakdown');
        });

        Schema::dropIfExists('reviews');
    }
};
