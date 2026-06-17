<?php

namespace Tests\Feature;

use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrgPublicTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    public function test_public_branding_returns_venue_shape(): void
    {
        $res = $this->getJson('/api/v1/orgs/everyday-badminton/public');

        $res->assertOk()
            ->assertJsonStructure(['slug', 'name', 'logoText', 'logoUrl', 'liffId', 'theme' => ['primary', 'warning', 'danger'], 'lineOaUrl', 'phone'])
            ->assertJsonPath('slug', 'everyday-badminton');
    }

    public function test_public_branding_never_exposes_secrets(): void
    {
        // Configure LINE secrets on the org, then confirm they never leak.
        $org = \App\Models\Organization::where('slug', 'everyday-badminton')->firstOrFail();
        $org->settings()->update([
            'line_channel_id' => '1660000000',
            'line_channel_secret' => 'super-secret',
            'line_messaging_token' => 'msg-secret',
            'line_liff_id' => '1660000000-abcd',
        ]);

        $body = $this->getJson('/api/v1/orgs/everyday-badminton/public')->assertOk()->getContent();

        $this->assertStringNotContainsString('super-secret', $body);
        $this->assertStringNotContainsString('msg-secret', $body);
        $this->assertStringContainsString('1660000000-abcd', $body); // liffId is public
    }

    public function test_unknown_slug_404s(): void
    {
        $this->getJson('/api/v1/orgs/nope-not-real/public')->assertNotFound();
    }
}
