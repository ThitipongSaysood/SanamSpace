<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ReportController extends Controller
{
    /**
     * GET /owner/reports/bookings.csv?from=&to= — export this org's bookings as CSV.
     * UTF-8 BOM included so Thai opens correctly in Excel.
     */
    public function exportBookings(Request $request): Response
    {
        $orgId = $request->attributes->get('currentOrganizationId');

        $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $bookings = Booking::query()
            ->forOrganization($orgId)
            ->when($request->filled('from'), fn ($q) => $q->whereDate('date', '>=', $request->query('from')))
            ->when($request->filled('to'), fn ($q) => $q->whereDate('date', '<=', $request->query('to')))
            ->with(['court', 'customer'])
            ->orderBy('date')
            ->orderBy('start')
            ->get();

        $rows = [['วันที่', 'รหัส', 'คอร์ท', 'ลูกค้า', 'เริ่ม', 'สิ้นสุด', 'ยอด', 'สถานะ']];
        foreach ($bookings as $b) {
            $rows[] = [
                Carbon::parse($b->date)->toDateString(),
                $b->code,
                $b->court?->name ?? '',
                $b->customer?->display_name ?? '',
                $b->start,
                $b->end,
                number_format((float) $b->amount, 2),
                $b->status,
            ];
        }

        $csv = "\xEF\xBB\xBF".collect($rows)
            ->map(fn ($r) => collect($r)->map(fn ($c) => '"'.str_replace('"', '""', (string) $c).'"')->implode(','))
            ->implode("\r\n");

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="bookings.csv"',
        ]);
    }
}
