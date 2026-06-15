<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\OrganizationSetting;
use Database\Seeders\SanamSpaceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Per-venue LINE integration on the Owner settings endpoints
 * (GET/PUT /owner/settings, under auth:sanctum + owner.org).
 *
 * Contract under test:
 * - channelId / liffId round-trip as plain fields.
 * - channelSecret / messagingToken are WRITE-ONLY: never returned, only a
 *   "*Set" boolean is exposed.
 * - the secrets are stored encrypted at rest (raw column != plaintext).
 * - a blank secret submit must NOT wipe an already-stored secret.
 */
class OwnerLineSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SanamSpaceSeeder::class);
    }

    private function ownerToken(): string
    {
        return $this->postJson('/api/v1/auth/admin/login', [
            'email' => 'owner@everyday.test',
            'password' => 'password',
        ])->json('token');
    }

    private function everydayOrg(): Organization
    {
        return Organization::where('slug', 'everyday-badminton')->firstOrFail();
    }

    public function test_put_settings_accepts_line_fields_and_returns_set_flags_without_secrets(): void
    {
        $secret = 'channel-secret-XYZ-123';
        $token = 'messaging-token-ABC-456';

        $put = $this->withToken($this->ownerToken())->putJson('/api/v1/owner/settings', [
            'lineChannelId' => '1660000000',
            'lineLiffId' => '1660000000-abcdEFGh',
            'lineChannelSecret' => $secret,
            'lineMessagingToken' => $token,
        ]);

        $put->assertOk()
            ->assertJsonPath('data.lineChannelId', '1660000000')
            ->assertJsonPath('data.lineLiffId', '1660000000-abcdEFGh')
            ->assertJsonPath('data.lineChannelSecretSet', true)
            ->assertJsonPath('data.lineMessagingTokenSet', true);

        // The raw secret values must NEVER appear in the response payload.
        $body = $put->getContent();
        $this->assertStringNotContainsString($secret, $body);
        $this->assertStringNotContainsString($token, $body);
        $this->assertArrayNotHasKey('lineChannelSecret', $put->json('data'));
        $this->assertArrayNotHasKey('lineMessagingToken', $put->json('data'));

        // GET reflects the same masked shape.
        $get = $this->withToken($this->ownerToken())->getJson('/api/v1/owner/settings');
        $get->assertOk()
            ->assertJsonPath('data.lineChannelId', '1660000000')
            ->assertJsonPath('data.lineLiffId', '1660000000-abcdEFGh')
            ->assertJsonPath('data.lineChannelSecretSet', true)
            ->assertJsonPath('data.lineMessagingTokenSet', true);
        $this->assertStringNotContainsString($secret, $get->getContent());
        $this->assertStringNotContainsString($token, $get->getContent());
    }

    public function test_line_secrets_are_stored_encrypted_at_rest(): void
    {
        $secret = 'plaintext-channel-secret-777';
        $token = 'plaintext-messaging-token-888';

        $this->withToken($this->ownerToken())->putJson('/api/v1/owner/settings', [
            'lineChannelSecret' => $secret,
            'lineMessagingToken' => $token,
        ])->assertOk();

        $orgId = $this->everydayOrg()->id;

        // Read the RAW column straight from the DB (bypassing the model cast):
        // it must be ciphertext, not the plaintext we sent.
        $row = DB::table('organization_settings')->where('organization_id', $orgId)->first();
        $this->assertNotNull($row->line_channel_secret);
        $this->assertNotNull($row->line_messaging_token);
        $this->assertNotSame($secret, $row->line_channel_secret);
        $this->assertNotSame($token, $row->line_messaging_token);

        // But the model decrypts back to the original plaintext.
        $setting = OrganizationSetting::where('organization_id', $orgId)->firstOrFail();
        $this->assertSame($secret, $setting->line_channel_secret);
        $this->assertSame($token, $setting->line_messaging_token);
    }

    public function test_blank_secret_submit_does_not_wipe_an_existing_secret(): void
    {
        $secret = 'keep-me-channel-secret';

        // First, store a secret.
        $this->withToken($this->ownerToken())->putJson('/api/v1/owner/settings', [
            'lineChannelSecret' => $secret,
        ])->assertOk();

        // Then submit a blank secret while changing another LINE field.
        $this->withToken($this->ownerToken())->putJson('/api/v1/owner/settings', [
            'lineChannelId' => '1660000001',
            'lineChannelSecret' => '',
        ])->assertOk()
            ->assertJsonPath('data.lineChannelId', '1660000001')
            // The existing secret survives the blank submit.
            ->assertJsonPath('data.lineChannelSecretSet', true);

        $setting = OrganizationSetting::where('organization_id', $this->everydayOrg()->id)->firstOrFail();
        $this->assertSame($secret, $setting->line_channel_secret);
    }

    public function test_settings_requires_owner_auth(): void
    {
        $this->putJson('/api/v1/owner/settings', [
            'lineChannelId' => '1660000000',
        ])->assertUnauthorized();
    }
}
