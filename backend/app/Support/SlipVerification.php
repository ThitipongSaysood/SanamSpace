<?php

namespace App\Support;

/**
 * The result a slip-verification provider returns for one slip. Deliberately
 * flat and provider-neutral — a SlipOK/EasySlip driver maps its own JSON into
 * this, and the auto-approve rules only read this shape.
 */
class SlipVerification
{
    /**
     * @param  array<string,mixed>  $raw  provider response, kept for audit
     */
    public function __construct(
        public bool $ok,
        public ?float $amount = null,
        public ?string $receiverRef = null,
        public ?string $senderName = null,
        public ?string $transRef = null,
        public ?string $transDate = null,
        public array $raw = [],
    ) {}

    /** The slip could not be verified (fake, unreadable, or no provider). */
    public static function fail(): self
    {
        return new self(ok: false);
    }
}
