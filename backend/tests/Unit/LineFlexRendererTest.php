<?php

namespace Tests\Unit;

use App\Support\LineFlexRenderer;
use PHPUnit\Framework\TestCase;

class LineFlexRendererTest extends TestCase
{
    private function render(array $blocks, array $vars = []): array
    {
        return (new LineFlexRenderer)->render($blocks, $vars);
    }

    public function test_it_substitutes_placeholders_and_builds_a_bubble(): void
    {
        $bubble = $this->render([
            ['type' => 'title', 'text' => '{{venueName}}'],
            ['type' => 'infoRow', 'label' => 'ลูกค้า', 'value' => '{{customerName}}'],
        ], ['venueName' => 'Semi Tennis', 'customerName' => 'สมชาย']);

        $this->assertSame('bubble', $bubble['type']);
        $json = json_encode($bubble, JSON_UNESCAPED_UNICODE);
        $this->assertStringContainsString('Semi Tennis', $json);
        $this->assertStringContainsString('สมชาย', $json);
        // An unknown token renders empty, never as the literal {{...}}.
        $this->assertStringNotContainsString('{{', $json);
    }

    public function test_a_button_with_no_valid_link_is_dropped_not_the_card(): void
    {
        $bubble = $this->render([
            ['type' => 'title', 'text' => 'Hi'],
            ['type' => 'buttonRow', 'buttons' => [
                ['type' => 'button', 'label' => 'ดูการจอง', 'url' => '{{bookingUrl}}'], // unresolved → dropped
                ['type' => 'button', 'label' => 'แผนที่', 'url' => 'https://maps.example/x'], // kept
            ]],
        ], []);

        $contents = $bubble['body']['contents'];
        $row = collect($contents)->firstWhere('layout', 'horizontal');
        $this->assertNotNull($row, 'the button row should survive with its one valid button');
        $this->assertCount(1, $row['contents']);
        $this->assertSame('https://maps.example/x', $row['contents'][0]['action']['uri']);
    }

    public function test_a_non_http_image_is_skipped_so_line_never_rejects_the_message(): void
    {
        $bubble = $this->render([
            ['type' => 'image', 'url' => 'not-a-url'],
            ['type' => 'text', 'text' => 'ok'],
        ], []);

        $types = array_column($bubble['body']['contents'], 'type');
        $this->assertNotContains('image', $types);
        $this->assertContains('text', $types);
    }

    public function test_an_empty_template_still_produces_a_valid_bubble(): void
    {
        $bubble = $this->render([], []);
        $this->assertNotEmpty($bubble['body']['contents']);
    }
}
