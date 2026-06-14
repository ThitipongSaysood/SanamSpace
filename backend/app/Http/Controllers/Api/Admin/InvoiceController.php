<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminInvoiceResource;
use App\Models\Invoice;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Mail;

class InvoiceController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return AdminInvoiceResource::collection(
            Invoice::query()->orderByDesc('issue_date')->orderByDesc('created_at')->get(),
        );
    }

    /**
     * POST /admin/invoices/{id}/pay — mark an invoice as paid (records the paid date).
     * Once paid, the document becomes a receipt (ใบเสร็จรับเงิน).
     */
    public function pay(string $id): AdminInvoiceResource
    {
        $invoice = Invoice::findOrFail($id);
        $invoice->update([
            'status' => 'paid',
            'paid_date' => $invoice->paid_date ?: now()->format('Y-m-d'),
        ]);

        return new AdminInvoiceResource($invoice->fresh());
    }

    /**
     * POST /admin/invoices/{id}/send — email the document to the org.
     * Wording adapts: a paid invoice is sent as a receipt, otherwise as an invoice/reminder.
     * Resolves the org's contact email from its settings (by name).
     */
    public function send(string $id): JsonResponse
    {
        $invoice = Invoice::findOrFail($id);
        $email = Organization::where('name', $invoice->organization_name)->first()?->settings?->email;

        if (! $email) {
            return response()->json(['sent' => false, 'message' => 'ไม่พบอีเมลของลูกค้า'], 422);
        }

        $isReceipt = $invoice->status === 'paid';
        $docName = $isReceipt ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้';

        $body = "เรียน {$invoice->organization_name}\n\n"
            ."{$docName}เลขที่ {$invoice->number}\n"
            ."ยอด ฿".number_format((float) $invoice->amount, 2)."\n"
            ."วันที่ออก {$invoice->issue_date} · ครบกำหนด {$invoice->due_date}\n"
            .($isReceipt ? "ชำระเมื่อ {$invoice->paid_date} · สถานะ: ชำระแล้ว\n" : "สถานะ: ค้างชำระ\n")
            ."\nขอบคุณที่ใช้บริการ SanamSpace";

        try {
            Mail::raw($body, function ($m) use ($email, $invoice, $docName) {
                $m->to($email)->subject("{$docName} {$invoice->number} - SanamSpace");
            });
        } catch (\Throwable $e) {
            return response()->json(['sent' => false, 'message' => 'ส่งอีเมลไม่สำเร็จ'], 500);
        }

        return response()->json(['sent' => true, 'email' => $email, 'isReceipt' => $isReceipt]);
    }
}
