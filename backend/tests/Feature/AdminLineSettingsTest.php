<?php

namespace Tests\Feature;

use App\Models\Organization;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AdminLineSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    /** Bearer token for the seeded platform super admin. */
    private function superToken(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'super@sanamspace.test',
            'password' => 'password',
        ])->json('token');
    }

    public function test_update_settings_saves_line_fields_and_masks_secrets(): void
    {
        $response = $this->withToken($this->superToken())
            ->putJson('/api/v1/admin/organizations/everyday-badminton/settings', [
                'lineChannelId' => '1234567890',
                'lineLiffId' => '1234567890-abcdEFGH',
                'lineChannelSecret' => 'super-secret-channel',
                'lineMessagingToken' => 'super-secret-token',
            ])
            ->assertOk();

        // Non-secret fields are echoed back; *Set flags reflect stored secrets.
        $response->assertJsonPath('data.settings.lineChannelId', '1234567890')
            ->assertJsonPath('data.settings.lineLiffId', '1234567890-abcdEFGH')
            ->assertJsonPath('data.settings.lineChannelSecretSet', true)
            ->assertJsonPath('data.settings.lineMessagingTokenSet', true);

        // Raw secrets are NEVER returned in any shape.
        $body = $response->json();
        $this->assertStringNotContainsString('super-secret-channel', json_encode($body));
        $this->assertStringNotContainsString('super-secret-token', json_encode($body));
        $this->assertArrayNotHasKey('lineChannelSecret', $response->json('data.settings'));
        $this->assertArrayNotHasKey('lineMessagingToken', $response->json('data.settings'));

        // Secrets stored ENCRYPTED at rest: raw column value differs from plaintext,
        // but the model cast decrypts back to the original.
        $org = Organization::where('slug', 'everyday-badminton')->firstOrFail();
        $rawSecret = DB::table('organization_settings')
            ->where('organization_id', $org->id)
            ->value('line_channel_secret');
        $this->assertNotSame('super-secret-channel', $rawSecret);
        $this->assertNotEmpty($rawSecret);
        $this->assertSame('super-secret-channel', $org->settings->line_channel_secret);
        $this->assertSame('super-secret-token', $org->settings->line_messaging_token);
    }

    public function test_blank_secret_does_not_wipe_existing_secret(): void
    {
        $token = $this->superToken();

        // Seed a secret.
        $this->withToken($token)
            ->putJson('/api/v1/admin/organizations/everyday-badminton/settings', [
                'lineChannelSecret' => 'keep-me',
            ])->assertOk();

        $this->app['auth']->forgetGuards();

        // Update only the channel id with a blank secret — secret must survive.
        $this->withToken($token)
            ->putJson('/api/v1/admin/organizations/everyday-badminton/settings', [
                'lineChannelId' => '999',
                'lineChannelSecret' => '',
            ])->assertOk()
            ->assertJsonPath('data.settings.lineChannelId', '999')
            ->assertJsonPath('data.settings.lineChannelSecretSet', true);

        $org = Organization::where('slug', 'everyday-badminton')->firstOrFail();
        $this->assertSame('keep-me', $org->settings->line_channel_secret);
    }

    public function test_update_settings_requires_super_admin(): void
    {
        $ownerToken = $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');

        $this->withToken($ownerToken)
            ->putJson('/api/v1/admin/organizations/everyday-badminton/settings', [
                'lineChannelId' => 'nope',
            ])->assertForbidden();
    }
}
