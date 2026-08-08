<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\CustomerTimelineEntry;

/**
 * Writes a customer's activity timeline as things actually happen.
 *
 * Until now the only thing that ever wrote here was the seeder, so a real
 * customer's timeline was empty and a demo one looked full — the CRM screen was
 * showing fixtures. The observers in App\Observers call this.
 *
 * Every write is idempotent on (customer, type, title, occurred_at) because
 * model events can fire more than once for one real-world action — a booking
 * saved twice in a request would otherwise read as two bookings.
 */
class TimelineRecorder
{
    public function record(
        ?string $organizationId,
        ?string $customerId,
        string $type,
        string $title,
        ?string $description = null,
        ?\DateTimeInterface $occurredAt = null,
    ): void {
        // A walk-in booking has no customer, and an erased one must not gain
        // new history. Neither is an error — there is just nothing to write.
        if (! $customerId || ! $organizationId) {
            return;
        }

        $occurredAt ??= now();

        CustomerTimelineEntry::query()->firstOrCreate(
            [
                'customer_id' => $customerId,
                'type' => $type,
                'title' => $title,
                'occurred_at' => $occurredAt,
            ],
            [
                'organization_id' => $organizationId,
                'description' => $description,
            ],
        );
    }

    /** Convenience for the common case of having the customer to hand. */
    public function forCustomer(Customer $customer, string $type, string $title, ?string $description = null): void
    {
        $this->record($customer->organization_id, $customer->id, $type, $title, $description);
    }
}
