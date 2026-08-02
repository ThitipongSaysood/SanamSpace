<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->registerThaiPdfFont();
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
