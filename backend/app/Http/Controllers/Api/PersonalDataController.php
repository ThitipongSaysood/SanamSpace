<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Services\PersonalDataService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * The customer's own data: a copy of it, or the end of it (PDPA).
 *
 * Like consent, every route here acts on the authenticated customer and takes
 * no id — there is nothing to guess, so no one can export or erase anyone else.
 */
class PersonalDataController extends Controller
{
    public function __construct(private readonly PersonalDataService $data) {}

    /**
     * GET /me/data — everything the venue holds, as a JSON download.
     *
     * A download rather than a screen: the right is to receive a copy in a
     * portable form, and a page of text the customer cannot keep is not that.
     */
    public function export(Request $request): JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user();

        $filename = 'sanamspace-my-data-'.now()->format('Y-m-d').'.json';

        return response()
            ->json($this->data->export($customer), 200, [
                'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }

    /**
     * DELETE /me — erase the person, keep the venue's accounts.
     *
     * Requires the customer to type their own display name back. This cannot be
     * undone and it signs them out of every device, so a mis-tap must not be
     * enough to trigger it.
     */
    public function destroy(Request $request): JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user();

        $data = $request->validate([
            'confirmName' => ['required', 'string'],
        ]);

        if (trim($data['confirmName']) !== trim((string) $customer->display_name)) {
            throw ValidationException::withMessages([
                'confirmName' => 'ชื่อไม่ตรงกับชื่อในบัญชี — พิมพ์ให้ตรงเพื่อยืนยันการลบ',
            ]);
        }

        $this->data->erase($customer);

        return response()->json([
            'message' => 'ลบข้อมูลส่วนบุคคลเรียบร้อย ประวัติการจองและการชำระเงินถูกเก็บไว้ตามกฎหมายบัญชี แต่ไม่ผูกกับตัวคุณอีกต่อไป',
        ]);
    }
}
