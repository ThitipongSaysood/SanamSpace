<?php

namespace App\Services;

use App\Models\PlatformSetting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/**
 * Creates portable, database-agnostic backups: every important table is dumped
 * to a single timestamped JSON file on the local disk (storage/app/backups).
 * Works the same on SQLite, MySQL/MariaDB, etc. — no mysqldump dependency.
 */
class BackupService
{
    private const DIR = 'backups';

    /** Tables included in a backup (only those that actually exist are dumped). */
    private const TABLES = [
        'organizations', 'organization_settings', 'organization_users', 'users',
        'customers', 'memberships', 'wallets', 'wallet_transactions',
        'branches', 'courts', 'bookings', 'payments', 'payment_slips',
        'plans', 'features', 'plan_features', 'subscriptions',
        'invoices', 'platform_transactions', 'support_tickets', 'announcements',
        'promotions', 'venue_packages', 'reviews', 'platform_settings',
    ];

    /** Build a new backup file and return its metadata. */
    public function create(): array
    {
        $data = [];
        foreach (self::TABLES as $table) {
            if (Schema::hasTable($table)) {
                $data[$table] = DB::table($table)->get();
            }
        }

        $payload = [
            'app' => 'SanamSpace',
            'createdAt' => now()->toIso8601String(),
            'tables' => $data,
        ];

        $name = 'backup-'.now()->format('Ymd-His').'.json';
        Storage::disk('local')->put(self::DIR.'/'.$name, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        $this->prune();

        return $this->meta($name);
    }

    /** All existing backups, newest first. */
    public function list(): array
    {
        $disk = Storage::disk('local');
        if (! $disk->exists(self::DIR)) {
            return [];
        }

        return collect($disk->files(self::DIR))
            ->filter(fn ($path) => str_ends_with($path, '.json'))
            ->map(fn ($path) => $this->meta(basename($path)))
            ->sortByDesc('createdAt')
            ->values()
            ->all();
    }

    /** Absolute storage path for a validated backup name, or null if missing. */
    public function path(string $name): ?string
    {
        if (! $this->isValidName($name)) {
            return null;
        }
        $disk = Storage::disk('local');
        $rel = self::DIR.'/'.$name;

        return $disk->exists($rel) ? $disk->path($rel) : null;
    }

    public function isValidName(string $name): bool
    {
        return (bool) preg_match('/^backup-\d{8}-\d{6}\.json$/', $name);
    }

    /** Delete backups older than the configured retention window. */
    private function prune(): void
    {
        $days = (int) (PlatformSetting::query()->value('backup_retention_days') ?: 30);
        $cutoff = now()->subDays($days)->getTimestamp();
        $disk = Storage::disk('local');

        foreach ($disk->files(self::DIR) as $path) {
            if (str_ends_with($path, '.json') && $disk->lastModified($path) < $cutoff) {
                $disk->delete($path);
            }
        }
    }

    private function meta(string $name): array
    {
        $disk = Storage::disk('local');
        $rel = self::DIR.'/'.$name;
        $bytes = $disk->exists($rel) ? $disk->size($rel) : 0;

        return [
            'name' => $name,
            'size' => $bytes,
            'sizeLabel' => $this->humanSize($bytes),
            'createdAt' => $disk->exists($rel)
                ? date('c', $disk->lastModified($rel))
                : now()->toIso8601String(),
        ];
    }

    private function humanSize(int $bytes): string
    {
        if ($bytes >= 1_048_576) {
            return round($bytes / 1_048_576, 2).' MB';
        }
        if ($bytes >= 1024) {
            return round($bytes / 1024, 1).' KB';
        }

        return $bytes.' B';
    }
}
