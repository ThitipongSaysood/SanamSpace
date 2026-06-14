<?php
namespace App\Http\Resources;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
class AdminInvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'number' => $this->number,
            'organizationName' => $this->organization_name,
            'amount' => (float) $this->amount,
            'status' => $this->status,
            'issueDate' => $this->issue_date,
            'dueDate' => $this->due_date,
        ];
    }
}
