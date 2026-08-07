<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Welcome banners become a list a venue can grow, not one slot on the settings
 * row.
 *
 * A venue running a holiday notice AND a promotion had to choose between them,
 * or rewrite the one banner every time. Each banner now switches on and off on
 * its own, so a seasonal one can be parked and brought back rather than
 * retyped.
 *
 * The single welcome_* fields move into the first banner and then leave
 * organization_settings — keeping both would give the customer app two places
 * to read the same thing from.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('welcome_banners', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->string('title', 120)->nullable();
            $table->text('message')->nullable();
            $table->string('image_url', 2000)->nullable();
            $table->string('link', 2000)->nullable();
            // On by default: a banner is created because someone wants it shown.
            $table->boolean('is_active')->default(true);
            // Off by default: a dialog in someone's face on entry is the venue's
            // call to make, not the platform's.
            $table->boolean('popup')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            // The customer app asks one question of this table: the active
            // banners for one venue, in order.
            $table->index(['organization_id', 'is_active', 'sort_order']);
        });

        $this->carryOverExistingBanners();

        Schema::table('organization_settings', function (Blueprint $table) {
            $table->dropColumn(['welcome_title', 'welcome_message', 'welcome_image_url', 'welcome_link', 'welcome_popup']);
        });
    }

    public function down(): void
    {
        Schema::table('organization_settings', function (Blueprint $table) {
            $table->string('welcome_title', 120)->nullable();
            $table->text('welcome_message')->nullable();
            $table->string('welcome_image_url', 2000)->nullable();
            $table->string('welcome_link', 2000)->nullable();
            $table->boolean('welcome_popup')->default(false);
        });

        // Fold the first banner back into the settings row, so rolling back
        // keeps whatever the venue had on screen instead of blanking it.
        foreach (DB::table('welcome_banners')->orderBy('sort_order')->orderBy('created_at')->get() as $banner) {
            DB::table('organization_settings')
                ->where('organization_id', $banner->organization_id)
                ->whereNull('welcome_title')
                ->whereNull('welcome_message')
                ->whereNull('welcome_image_url')
                ->update([
                    'welcome_title' => $banner->title,
                    'welcome_message' => $banner->message,
                    'welcome_image_url' => $banner->image_url,
                    'welcome_link' => $banner->link,
                    'welcome_popup' => $banner->popup,
                ]);
        }

        Schema::dropIfExists('welcome_banners');
    }

    /**
     * Move each venue's existing single banner into the new table.
     *
     * Rows with nothing in any of the three content fields are skipped — an
     * empty banner would show up in the owner's list as a blank card to delete.
     */
    private function carryOverExistingBanners(): void
    {
        if (! Schema::hasColumn('organization_settings', 'welcome_title')) {
            return;
        }

        $now = now();

        $existing = DB::table('organization_settings')
            ->where(function ($q) {
                $q->whereNotNull('welcome_title')
                    ->orWhereNotNull('welcome_message')
                    ->orWhereNotNull('welcome_image_url');
            })
            ->get();

        foreach ($existing as $setting) {
            DB::table('welcome_banners')->insert([
                'id' => (string) Str::uuid(),
                'organization_id' => $setting->organization_id,
                'title' => $setting->welcome_title,
                'message' => $setting->welcome_message,
                'image_url' => $setting->welcome_image_url,
                'link' => $setting->welcome_link,
                'is_active' => true,
                'popup' => (bool) ($setting->welcome_popup ?? false),
                'sort_order' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
};
