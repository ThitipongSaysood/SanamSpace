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
     * POST /admin/invoices/{id}/send — email the invoice/reminder to the org.
     * Resolves the org's contact email from its settings (by name).
     */
    public function send(string $id): JsonResponse
    {
        $invoice = Invoice::findOrFail($id);
        $email = Organization::where('name', $invoice->organization_name)->first()?->settings?->email;

        if (! $email) {
            return response()->json(['sent' => false, 'message' => 'ไม่พบอีเมลของลูกค้า'], 422);
        }

        $body = "เรียน {$invoice->organization_name}\n\n"
            ."ใบแจ้งหนี้เลขที่ {$invoice->number}\n"
            ."ยอดชำระ ฿".number_format((float) $invoice->amount, 2)."\n"
            ."วันที่ออก {$invoice->issue_date} · ครบกำหนด {$invoice->due_date}\n"
            ."สถานะ: {$invoice->status}\n\n"
            ."ขอบคุณที่ใช้บริการ SanamSpace";

        try {
            Mail::raw($body, function ($m) use ($email, $invoice) {
                $m->to($email)->subject("ใบแจ้งหนี้ {$invoice->number} - SanamSpace");
            });
        } catch (\Throwable $e) {
            return response()->json(['sent' => false, 'message' => 'ส่งอีเมลไม่สำเร็จ'], 500);
        }

        return response()->json(['sent' => true, 'email' => $email]);
    }
}
