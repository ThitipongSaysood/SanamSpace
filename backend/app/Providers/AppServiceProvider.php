<?php

namespace App\Providers;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\Membership;
use App\Models\Payment;
use App\Observers\BookingObserver;
use App\Observers\CustomerObserver;
use App\Observers\MembershipObserver;
use App\Observers\PaymentObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Slip-verification provider (Phase 1). The connection is platform-level
        // (admin-set on PlatformSetting), with the env config as a fallback for
        // local/CI. Default = Null (dedupe only); a real driver slots in here
        // without touching callers.
        $this->app->bind(\App\Services\Slip\SlipVerifier::class, function () {
            $cfg = $this->slipProviderConfig();

            return match ($cfg['driver']) {
                'slip2go' => new \App\Services\Slip\Slip2GoVerifier($cfg['endpoint'], $cfg['key']),
                'slipok' => new \App\Services\Slip\SlipOkVerifier($cfg['endpoint'], $cfg['key']),
                default => new \App\Services\Slip\NullSlipVerifier(),
            };
        });
    }

    /**
     * The slip provider connection: the admin-set platform settings win, with
     * the env config as a fallback so a local/CI box works without the DB row.
     * Wrapped in rescue() because the binding may resolve before the table
     * exists (e.g. during `migrate`), where it must quietly fall back to config.
     *
     * @return array{driver: string, key: ?string, endpoint: ?string}
     */
    private function slipProviderConfig(): array
    {
        $p = rescue(fn () => \App\Models\PlatformSetting::query()->first(), null, false);

        return [
            'driver' => (string) ($p?->slip_verify_driver ?: config('services.slip.driver', 'null')),
            'key' => $p?->slip_verify_key ?: config('services.slip.key'),
            'endpoint' => $p?->slip_verify_endpoint ?: config('services.slip.endpoint'),
        ];
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->registerThaiPdfFont();
        $this->registerTimelineObservers();
    }

    /**
     * Keep the CRM timeline written by what happens, not by the seeder.
     *
     * Before this the only thing that ever wrote `customer_timeline` was demo
     * data: a real customer's history was empty while a seeded one looked full,
     * so the CRM screen was showing fixtures to anyone who trusted it.
     *
     * Observers rather than explicit calls at each site, because "record this
     * too" is exactly the line a future controller forgets.
     */
    private function registerTimelineObservers(): void
    {
        Booking::observe(BookingObserver::class);
        Customer::observe(CustomerObserver::class);
        Membership::observe(MembershipObserver::class);
        Payment::observe(PaymentObserver::class);
    }

    /**
     * Teach dompdf the Thai font used by billing PDFs.
     *
     * dompdf ships only the core PDF fonts, none of which contain Thai — an
     * invoice would render as rows of boxes. Sarabun (OFL) is bundled in
     * resources/fonts and installed into the dompdf font cache on boot; the
     * install is a no-op once the cache entry exists.
     */
    private function registerThaiPdfFont(): void
    {
        if (! class_exists(\Dompdf\Dompdf::class)) {
            return;
        }

        $cacheDir = storage_path('fonts');
        // Already installed — the common path, so bail before touching disk.
        if (is_file($cacheDir.'/installed-fonts.json')
            && str_contains((string) @file_get_contents($cacheDir.'/installed-fonts.json'), 'sarabun')) {
            return;
        }

        $regular = resource_path('fonts/Sarabun-Regular.ttf');
        $bold = resource_path('fonts/Sarabun-Bold.ttf');

        if (! is_file($regular)) {
            return;
        }

        if (! is_dir($cacheDir)) {
            @mkdir($cacheDir, 0775, true);
        }

        try {
            // The options MUST point at the same dirs as config/dompdf.php —
            // a bare Dompdf writes into the package's own font dir, and the
            // renderer then never finds the font (silently falling back to
            // Helvetica, which has no Thai glyphs at all).
            $options = new \Dompdf\Options();
            $options->setFontDir($cacheDir);
            $options->setFontCache($cacheDir);
            // registerFont() reads the TTF through dompdf's file:// rules, which
            // refuse anything outside the chroot (public/ by default) and just
            // return false. resources/fonts has to be allowed explicitly.
            $options->setChroot([resource_path('fonts'), base_path()]);

            $dompdf = new \Dompdf\Dompdf($options);
            $metrics = $dompdf->getFontMetrics();
            $metrics->registerFont(
                ['family' => 'sarabun', 'style' => 'normal', 'weight' => 'normal'],
                $regular,
            );
            if (is_file($bold)) {
                $metrics->registerFont(
                    ['family' => 'sarabun', 'style' => 'normal', 'weight' => 'bold'],
                    $bold,
                );
            }
        } catch (\Throwable) {
            // A PDF with the wrong font beats a 500 on every request.
        }
    }
}
