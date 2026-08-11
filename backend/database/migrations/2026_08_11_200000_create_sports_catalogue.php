<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Give the sport types an owner.
 *
 * Until now there was none. The same list was written out by hand in six
 * places and no two agreed: the customer app's loader knew ten sports, the
 * notification icon knew twelve, and the dropdown a venue actually picks from
 * offered four. A venue that rents pickleball could not create a court for it
 * even though the icon for it was already sitting in the code.
 *
 * Worse, the two things that decide how the app LOOKS — the notification icon
 * and the first-entry loader — read `branches.sports`, which was a plain text
 * box the owner typed into, validated as nothing more than `string|max:50`. A
 * key the code did not recognise was dropped in silence and the venue fell back
 * to badminton. A tennis venue was showing its customers a shuttlecock and
 * nothing anywhere said why.
 *
 * The emoji and the colour move into the table with the key, because they are
 * the reason this needs managing at all: adding a sport used to mean editing
 * two frontend files and deploying.
 *
 * Nothing is thrown away. Anything already stored that this catalogue does not
 * name is imported as an inactive row rather than being left to fail the
 * validation that now exists — a venue must never be locked out of editing its
 * own branch because of a word it typed months ago.
 */
return new class extends Migration
{
    /** key => [ชื่อไทย, emoji, colour] — the union of the six old lists. */
    private const SEED = [
        'badminton' => ['แบดมินตัน', '🏸', '#ef4444'],
        'futsal' => ['ฟุตซอล', '⚽', '#10b981'],
        'football' => ['ฟุตบอล', '⚽', '#10b981'],
        'tennis' => ['เทนนิส', '🎾', '#a3e635'],
        'pickleball' => ['พิคเคิลบอล', '🎾', '#84cc16'],
        'squash' => ['สควอช', '🎾', '#f97316'],
        'basketball' => ['บาสเกตบอล', '🏀', '#ea580c'],
        'volleyball' => ['วอลเลย์บอล', '🏐', '#3b82f6'],
        'takraw' => ['ตะกร้อ', '🏐', '#8b5cf6'],
        'tabletennis' => ['ปิงปอง', '🏓', '#eab308'],
    ];

    /**
     * Two keys the old code accepted as second names for a sport it already
     * had. Kept as aliases rather than rows: two "ฟุตบอล" in a picker is a
     * question the person choosing cannot answer.
     */
    private const ALIASES = ['soccer' => 'football', 'pingpong' => 'tabletennis'];

    public function up(): void
    {
        Schema::create('sports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            // The key stored on branches.sports and courts.sport. Immutable in
            // practice: renaming it would orphan every row pointing at it.
            $table->string('key', 50)->unique();
            $table->string('name');
            // What the loader bounces and the notification card floats.
            $table->string('emoji', 16);
            // Hex, used for the sport's chip on the loading screen.
            $table->string('color', 7);
            $table->unsignedInteger('sort_order')->default(0);
            // Hidden from the pickers without breaking venues already using it.
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        $order = 0;
        foreach (self::SEED as $key => [$name, $emoji, $color]) {
            DB::table('sports')->insert([
                'id' => (string) Str::uuid(),
                'key' => $key,
                'name' => $name,
                'emoji' => $emoji,
                'color' => $color,
                'sort_order' => $order += 10,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->foldAliases();
        $this->importUnknownKeys($order);
    }

    /**
     * Rewrite the alias keys to the sport they always meant.
     *
     * Left alone they would fail `exists:sports,key` the next time the owner
     * saved that branch, which is a strange way to learn that "soccer" was
     * never a real value.
     */
    private function foldAliases(): void
    {
        foreach (self::ALIASES as $alias => $real) {
            DB::table('courts')->where('sport', $alias)->update(['sport' => $real]);
        }

        foreach (DB::table('branches')->whereNotNull('sports')->get(['id', 'sports']) as $branch) {
            $sports = json_decode($branch->sports, true);

            if (! is_array($sports)) {
                continue;
            }

            $folded = array_values(array_unique(array_map(
                fn ($s) => self::ALIASES[strtolower(trim((string) $s))] ?? strtolower(trim((string) $s)),
                $sports,
            )));

            if ($folded !== $sports) {
                DB::table('branches')->where('id', $branch->id)->update(['sports' => json_encode($folded)]);
            }
        }
    }

    /**
     * Anything a venue already stored that the seed does not name.
     *
     * Imported inactive and marked, so it keeps working and shows up in the
     * admin screen as something to rename or merge — rather than silently
     * becoming invalid the moment validation starts caring.
     */
    private function importUnknownKeys(int $order): void
    {
        $known = DB::table('sports')->pluck('key')->all();

        $stored = collect(DB::table('courts')->distinct()->pluck('sport'))
            ->merge(DB::table('branches')->whereNotNull('sports')->pluck('sports')
                ->flatMap(fn ($json) => (array) json_decode($json, true)))
            ->map(fn ($s) => strtolower(trim((string) $s)))
            ->filter()
            ->unique()
            ->diff($known);

        foreach ($stored as $key) {
            DB::table('sports')->insert([
                'id' => (string) Str::uuid(),
                'key' => $key,
                'name' => $key,
                'emoji' => '🏟️',
                'color' => '#64748b',
                'sort_order' => $order += 10,
                'is_active' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sports');
    }
};
