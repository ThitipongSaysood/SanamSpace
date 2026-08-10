<?php

namespace App\Services;

use App\Models\Customer;
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
     * @return array{sent:int, failed:int, skipped:int, noToken:bool, results:array<string,array{status:string,reason:?string}>}
     *
     * `results` is per customer id, so the caller can keep a record of who was
     * actually reached rather than only how many were. Aggregate counts alone
     * cannot answer "have we already messaged this person".
     */
    public function pushText(?OrganizationSetting $settings, Collection $customers, string $text, ?string $imageUrl = null): array
    {
        // customer id => line user id, for the ones that have a profile.
        $byCustomer = $this->recipientIdsByCustomer($customers);
        $recipients = collect($byCustomer)->values()->unique()->values();
        $skipped = $customers->count() - count($byCustomer);

        $results = [];
        foreach ($customers as $customer) {
            if (! isset($byCustomer[$customer->id])) {
                $results[$customer->id] = ['status' => 'skipped', 'reason' => 'ไม่มีบัญชี LINE ที่ผูกไว้'];
            }
        }

        $token = $settings?->line_messaging_token;

        if (blank($token)) {
            // No channel token — nothing can be delivered, but this is not a
            // failure: the caller still records the broadcast.
            foreach ($customers as $customer) {
                $results[$customer->id] = ['status' => 'skipped', 'reason' => 'สนามยังไม่ได้ตั้งค่า LINE token'];
            }

            return ['sent' => 0, 'failed' => 0, 'skipped' => $customers->count(), 'noToken' => true, 'results' => $results];
        }

        if ($recipients->isEmpty()) {
            return ['sent' => 0, 'failed' => 0, 'skipped' => $skipped, 'noToken' => false, 'results' => $results];
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

        // LINE reports per request, not per recipient, so everyone in a chunk
        // shares that chunk's outcome. Recorded that way rather than guessed.
        $lineIdToCustomers = [];
        foreach ($byCustomer as $customerId => $lineId) {
            $lineIdToCustomers[$lineId][] = $customerId;
        }

        $mark = function (array $ids, string $status, ?string $reason) use (&$results, $lineIdToCustomers) {
            foreach ($ids as $lineId) {
                foreach ($lineIdToCustomers[$lineId] ?? [] as $customerId) {
                    $results[$customerId] = ['status' => $status, 'reason' => $reason];
                }
            }
        };

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
                    $mark($ids, 'sent', null);
                } else {
                    $failed += count($ids);
                    $mark($ids, 'failed', "LINE ตอบกลับ {$response->status()}");
                    Log::warning('LINE multicast failed', ['status' => $response->status(), 'body' => $response->body()]);
                }
            } catch (\Throwable $e) {
                $failed += count($ids);
                $mark($ids, 'failed', 'ส่งไม่สำเร็จ');
                Log::warning('LINE multicast threw', ['error' => $e->getMessage()]);
            }
        }

        return ['sent' => $sent, 'failed' => $failed, 'skipped' => $skipped, 'noToken' => false, 'results' => $results];
    }

    /**
     * Pushes one already-rendered Flex bubble to a single customer over the
     * LINE push API. Used for booking events (receipt, cancellation) — a
     * transactional message to one person, unlike the broadcast multicast.
     *
     * Returns a one-word outcome the caller can record: `sent`, `failed`,
     * `noToken` (venue hasn't configured LINE), or `noProfile` (customer never
     * linked LINE). Never throws — a messaging hiccup must not fail the booking
     * or payment that triggered it.
     *
     * @param  array<string,mixed>  $bubble  a LINE Flex bubble (from LineFlexRenderer)
     */
    public function pushFlex(?OrganizationSetting $settings, Customer $customer, string $altText, array $bubble): string
    {
        $token = $settings?->line_messaging_token;
        if (blank($token)) {
            return 'noToken';
        }

        $lineId = $this->recipientIdsByCustomer(collect([$customer]))[$customer->id] ?? null;
        if (! $lineId) {
            return 'noProfile';
        }

        $url = config('services.line.push_single_url', 'https://api.line.me/v2/bot/message/push');

        try {
            $response = Http::withToken($token)
                ->asJson()
                ->post($url, [
                    'to' => $lineId,
                    'messages' => [[
                        'type' => 'flex',
                        'altText' => mb_substr($altText, 0, 400),
                        'contents' => $bubble,
                    ]],
                ]);

            if ($response->successful()) {
                return 'sent';
            }

            Log::warning('LINE flex push failed', ['status' => $response->status(), 'body' => $response->body()]);

            return 'failed';
        } catch (\Throwable $e) {
            Log::warning('LINE flex push threw', ['error' => $e->getMessage()]);

            return 'failed';
        }
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
        return collect($this->recipientIdsByCustomer($customers))->values()->unique()->values();
    }

    /**
     * customer id => LINE user id, for customers that have a profile.
     *
     * Keeping the association (rather than only the ids) is what lets a send be
     * recorded per person; two customers sharing a LINE id both get a row.
     *
     * @param  Collection<int,\App\Models\Customer>  $customers
     * @return array<string,string>
     */
    private function recipientIdsByCustomer(Collection $customers): array
    {
        $map = [];

        foreach ($customers as $customer) {
            $lineId = $customer->relationLoaded('lineProfiles')
                ? optional($customer->lineProfiles->sortByDesc('created_at')->first())->line_user_id
                : optional($customer->lineProfiles()->latest()->first())->line_user_id;

            if ($lineId) {
                $map[$customer->id] = $lineId;
            }
        }

        return $map;
    }
}
