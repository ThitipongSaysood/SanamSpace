<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A platform billing document. Shared by the Super Admin billing screen and the
 * Owner's own billing page — the venue may see everything on its own invoice,
 * including the slip it uploaded.
 */
class AdminInvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'number' => $this->number,
            'organizationId' => $this->organization_id,
            'organizationName' => $this->organization_name,
            'planName' => $this->plan?->name,
            'amount' => (float) $this->amount,
            // Snapshot taken when the invoice was raised — never recomputed.
            'subtotal' => (float) ($this->subtotal ?: $this->amount),
            'vatAmount' => (float) $this->vat_amount,
            'vatRate' => (float) $this->vat_rate,
            // Issued only once the money is confirmed.
            'receiptNumber' => $this->receipt_number,
            'receiptDate' => $this->receipt_date,
            'periodMonths' => (int) ($this->period_months ?: 1),
            // 'owner' = the venue renewed itself, 'admin' = the platform billed them.
            'source' => $this->source ?: 'admin',
            'status' => $this->status,
            'issueDate' => $this->issue_date,
            'dueDate' => $this->due_date,
            'paidDate' => $this->paid_date,
            'slipUrl' => $this->slip_url,
            'slipUploadedAt' => $this->slip_uploaded_at?->toIso8601String(),
            'rejectReason' => $this->reject_reason,
        ];
    }
}
