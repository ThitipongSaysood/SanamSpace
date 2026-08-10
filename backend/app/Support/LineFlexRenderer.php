<?php

namespace App\Support;

/**
 * Turns a venue's block tree (what the owner arranges in the builder) into a
 * LINE Flex "bubble". The block vocabulary is deliberately small and every
 * block maps to a component LINE reliably renders — the builder never emits raw
 * Flex JSON, so a venue owner cannot produce a message LINE will reject.
 *
 * Every string prop is run through {{placeholder}} substitution against a
 * caller-supplied var map (customer name, court, time, amount, …) so one saved
 * template serves every booking.
 *
 * Block shapes:
 *   { type: "image",    url, aspectRatio? }         full-width image
 *   { type: "logo",     url }                        small centred image
 *   { type: "title",    text, size?, color?, align? }
 *   { type: "text",     text, size?, color?, align? }
 *   { type: "divider" }
 *   { type: "infoRow",  label, value, color? }       label left / value right
 *   { type: "button",   label, url, style?, color? } full-width
 *   { type: "buttonRow", buttons: [ {label,url,style?,color?} ] }   side by side
 */
class LineFlexRenderer
{
    /** Text sizes LINE accepts; anything else falls back to md. */
    private const TEXT_SIZES = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];

    /** @param array<int,array<string,mixed>> $blocks
     *  @param array<string,string|int|float|null> $vars
     *  @return array<string,mixed> a LINE Flex bubble */
    public function render(array $blocks, array $vars = []): array
    {
        $contents = [];
        foreach ($blocks as $block) {
            $component = $this->renderBlock(is_array($block) ? $block : [], $vars);
            if ($component !== null) {
                $contents[] = $component;
            }
        }

        // A body must have at least one component; give an empty template a
        // harmless filler rather than emitting an invalid bubble.
        if ($contents === []) {
            $contents[] = ['type' => 'text', 'text' => ' ', 'wrap' => true];
        }

        return [
            'type' => 'bubble',
            'body' => [
                'type' => 'box',
                'layout' => 'vertical',
                'spacing' => 'md',
                'contents' => $contents,
            ],
        ];
    }

    /** @param array<string,mixed> $b @param array<string,string|int|float|null> $vars */
    private function renderBlock(array $b, array $vars): ?array
    {
        $type = $b['type'] ?? '';

        return match ($type) {
            'image' => $this->image($this->sub($b['url'] ?? '', $vars), (string) ($b['aspectRatio'] ?? '20:13'), 'full'),
            'logo' => $this->image($this->sub($b['url'] ?? '', $vars), '1:1', 'md', 'center'),
            'title' => $this->text($this->sub($b['text'] ?? '', $vars), $b, 'lg', true),
            'text' => $this->text($this->sub($b['text'] ?? '', $vars), $b, 'sm', false),
            'divider' => ['type' => 'separator', 'margin' => 'md'],
            'infoRow' => $this->infoRow($b, $vars),
            'button' => $this->button($b, $vars),
            'buttonRow' => $this->buttonRow($b, $vars),
            default => null,
        };
    }

    private function image(string $url, string $aspectRatio, string $size, ?string $align = null): ?array
    {
        if (! $this->isHttp($url)) {
            return null; // LINE rejects a bubble with a non-http image url.
        }
        $img = [
            'type' => 'image',
            'url' => $url,
            'size' => $size,
            'aspectRatio' => $aspectRatio,
            'aspectMode' => 'cover',
        ];
        if ($align !== null) {
            $img['align'] = $align;
        }

        return $img;
    }

    /** @param array<string,mixed> $b */
    private function text(string $text, array $b, string $defaultSize, bool $bold): array
    {
        $out = [
            'type' => 'text',
            'text' => $text === '' ? ' ' : $text,
            'wrap' => true,
            'size' => $this->size($b['size'] ?? null, $defaultSize),
        ];
        if ($bold || ($b['weight'] ?? '') === 'bold') {
            $out['weight'] = 'bold';
        }
        if (! empty($b['color']) && $this->isHex($b['color'])) {
            $out['color'] = $b['color'];
        }
        if (in_array($b['align'] ?? '', ['start', 'center', 'end'], true)) {
            $out['align'] = $b['align'];
        }

        return $out;
    }

    /** @param array<string,mixed> $b @param array<string,string|int|float|null> $vars */
    private function infoRow(array $b, array $vars): array
    {
        $color = (! empty($b['color']) && $this->isHex($b['color'])) ? $b['color'] : '#111111';

        return [
            'type' => 'box',
            'layout' => 'horizontal',
            'contents' => [
                ['type' => 'text', 'text' => $this->sub($b['label'] ?? '', $vars) ?: ' ', 'size' => 'sm', 'color' => '#8A8A8A', 'flex' => 0, 'wrap' => true],
                ['type' => 'text', 'text' => $this->sub($b['value'] ?? '', $vars) ?: ' ', 'size' => 'sm', 'color' => $color, 'align' => 'end', 'weight' => 'bold', 'wrap' => true],
            ],
        ];
    }

    /** @param array<string,mixed> $b @param array<string,string|int|float|null> $vars */
    private function button(array $b, array $vars): ?array
    {
        $uri = $this->sub($b['url'] ?? '', $vars);
        $label = $this->sub($b['label'] ?? '', $vars);
        if (! $this->isHttp($uri) || $label === '') {
            return null; // A button with no valid link would sink the whole message.
        }
        $style = in_array($b['style'] ?? '', ['primary', 'secondary', 'link'], true) ? $b['style'] : 'primary';
        $out = [
            'type' => 'button',
            'style' => $style,
            'height' => 'sm',
            'action' => ['type' => 'uri', 'label' => mb_substr($label, 0, 40), 'uri' => $uri],
        ];
        if ($style === 'primary' && ! empty($b['color']) && $this->isHex($b['color'])) {
            $out['color'] = $b['color'];
        }

        return $out;
    }

    /** @param array<string,mixed> $b @param array<string,string|int|float|null> $vars */
    private function buttonRow(array $b, array $vars): ?array
    {
        $buttons = [];
        foreach ((array) ($b['buttons'] ?? []) as $btn) {
            $rendered = $this->button(is_array($btn) ? $btn : [], $vars);
            if ($rendered !== null) {
                $buttons[] = $rendered;
            }
        }
        if ($buttons === []) {
            return null;
        }

        return [
            'type' => 'box',
            'layout' => 'horizontal',
            'spacing' => 'sm',
            'contents' => $buttons,
        ];
    }

    private function size(mixed $size, string $default): string
    {
        return in_array($size, self::TEXT_SIZES, true) ? $size : $default;
    }

    /** Public {{placeholder}} substitution — used for altText and previews. */
    public function substitute(string $s, array $vars): string
    {
        return $this->sub($s, $vars);
    }

    /** Replace every {{key}} with its var, leaving unknown tokens blank. */
    private function sub(mixed $str, array $vars): string
    {
        $s = (string) $str;
        if (! str_contains($s, '{{')) {
            return $s;
        }

        return (string) preg_replace_callback('/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/', function ($m) use ($vars) {
            $val = $vars[$m[1]] ?? '';

            return $val === null ? '' : (string) $val;
        }, $s);
    }

    private function isHttp(string $url): bool
    {
        return str_starts_with($url, 'http://') || str_starts_with($url, 'https://');
    }

    private function isHex(mixed $c): bool
    {
        return is_string($c) && preg_match('/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/', $c) === 1;
    }
}
