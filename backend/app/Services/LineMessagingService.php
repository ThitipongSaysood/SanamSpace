<?php

namespace App\Services;

use App\Models\OrganizationSetting;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Pushes messages to customers over the LINE Messaging API, using the venue's
 * own channel access token (`organization_settings.line_messaging_token`,
 * stored encrypted). Until now that token was collected and never used — this
 * is the code path that finally reads it.
 *
 * Recipients are resolved to their LINE user ids via each customer's
 * LineProfile. A customer with no linked LINE profile is counted as `skipped`
 * (unreachable), never an error. When the venue hasn't configured a messaging
 * token, the whole send is skipped gracefully (`noToken`) so dev/self-hosted
 * venues without LINE don't blow up — the broadcast is still recorded.
 */
class LineMessagingService
{
    /** LINE caps multicast at 500 recipients per request. */
    private const MULTICAST_CHUNK = 500;

    /**
     * @param  Collection<int,\App\Models\Customer>  $customers
     * @return array{sent:int, failed:int, skipped:int, noToken:bool}
     */
    public function pushText(?OrganizationSetting $settings, Collection $customers, string $text, ?string $imageUrl = null): array
    {
        $recipients = $this->recipientLineIds($customers);
        $skipped = $customers->count() - $recipients->count();

        $token = $settings?->line_messaging_token;

        if (blank($token)) {
            // No channel token — nothing can be delivered, but this is not a
            // failure: the caller still records the broadcast.
            return ['sent' => 0, 'failed' => 0, 'skipped' => $customers->count(), 'noToken' => true];
        }

        if ($recipients->isEmpty()) {
            return ['sent' => 0, 'failed' => 0, 'skipped' => $skipped, 'noToken' => false];
        }

        $url = config('services.line.push_url', 'https://api.line.me/v2/bot/message/multicast');
        $sent = 0;
        $failed = 0;

        // A banner rides ahead of the text as a LINE image message (both URLs
        // must be public HTTPS for LINE to fetch them).
        $messages = [];
        if (filled($imageUrl)) {
            $messages[] = ['type' => 'image', 'originalContentUrl' => $imageUrl, 'previewImageUrl' => $imageUrl];
        }
        $messages[] = ['type' => 'text', 'text' => $text];

        foreach ($recipients->chunk(self::MULTICAST_CHUNK) as $chunk) {
            $ids = $chunk->values()->all();

            try {
                $response = Http::withToken($token)
                    ->asJson()
                    ->post($url, [
                        'to' => $ids,
                        'messages' => $messages,
                    ]);

                if ($response->successful()) {
                    $sent += count($ids);
                } else {
                    $failed += count($ids);
                    Log::warning('LINE multicast failed', ['status' => $response->status(), 'body' => $response->body()]);
                }
            } catch (\Throwable $e) {
                $failed += count($ids);
                Log::warning('LINE multicast threw', ['error' => $e->getMessage()]);
            }
        }

        return ['sent' => $sent, 'failed' => $failed, 'skipped' => $skipped, 'noToken' => false];
    }

    /**
     * How many of these customers are actually reachable over LINE (have a
     * linked profile). Used by the audience preview.
     *
     * @param  Collection<int,\App\Models\Customer>  $customers
     */
    public function reachableCount(Collection $customers): int
    {
        return $this->recipientLineIds($customers)->count();
    }

    /**
     * Distinct LINE user ids for the given customers (latest profile per
     * customer wins; a customer with no profile contributes nothing).
     *
     * @param  Collection<int,\App\Models\Customer>  $customers
     * @return Collection<int,string>
     */
    private function recipientLineIds(Collection $customers): Collection
    {
        return $customers
            ->map(fn ($customer) => $customer->relationLoaded('lineProfiles')
                ? optional($customer->lineProfiles->sortByDesc('created_at')->first())->line_user_id
                : optional($customer->lineProfiles()->latest()->first())->line_user_id)
            ->filter()
            ->unique()
            ->values();
    }
}
