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
        $this->registerPasswordResetUrl();
        $this->registerApiRateLimit();
    }

    /**
     * The baseline ceiling the whole API sits under (see bootstrap/app.php).
     *
     * Keyed by the BEARER TOKEN, never by `$request->user()`.
     *
     * Resolving the user here would be the same mistake this codebase already
     * paid for once: the limiter runs before the route's own middleware, so
     * asking it who is signed in caches a guard identity that later calls in
     * the same request lifecycle inherit — four multi-actor tests turned 403
     * the moment this was added that way. Hashing the token separates two
     * venues behind one office NAT just as well, and touches no guard.
     *
     * The ceiling is deliberately far above real use, and the number was
     * measured rather than picked. At 120/min the e2e suite failed nine specs;
     * at 600 it still failed three. Every request WITHOUT a token shares one
     * bucket by IP — and so do a venue's customers, because thirty people on
     * the hall's own wifi are one address. A limit a busy Saturday can reach is
     * a limit that takes the venue's bookings down to enforce nothing.
     *
     * So this is not a fairness control; it is a stop on a runaway client — a
     * loop polling without a delay, a scraper. Twenty requests a second from a
     * single address is far past anything a room full of people produces and
     * far under what a script does. The endpoints where a tight limit actually
     * matters (login, register, password reset, top-up, reviews, coupons,
     * slips) each carry their own, much lower.
     */
    private function registerApiRateLimit(): void
    {
        \Illuminate\Support\Facades\RateLimiter::for('api', function ($request) {
            $token = $request->bearerToken();

            return \Illuminate\Cache\RateLimiting\Limit::perMinute(1200)
                ->by($token ? 'tok:'.sha1($token) : 'ip:'.$request->ip());
        });
    }

    /**
     * Point the reset email at the owner portal, not at the API.
     *
     * Laravel's default builds the link from `APP_URL`, which here is the
     * Laravel app — a customer following it would land on a JSON 404. The
     * portal and the API are the same origin in production (`/api/v1` is
     * proxied), so `FRONTEND_URL` defaults to `APP_URL` and only needs setting
     * where the two are split, which is every development machine.
     */
    private function registerPasswordResetUrl(): void
    {
        \Illuminate\Auth\Notifications\ResetPassword::createUrlUsing(
            fn ($user, string $token) => rtrim(config('app.frontend_url') ?: config('app.url'), '/')
                .'/owner/reset-password?token='.$token
                .'&email='.urlencode($user->getEmailForPasswordReset()),
        );
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
