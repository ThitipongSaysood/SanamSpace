{{--
    Printable billing document — ใบแจ้งหนี้ / ใบเสร็จรับเงิน (+ ใบกำกับภาษี when taxed).

    Rendered to PDF by dompdf, so this is deliberately plain: tables for layout,
    no flexbox/grid, and no external assets (enable_remote is off). The Sarabun
    font is registered in AppServiceProvider — without it Thai renders as boxes.
--}}
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="utf-8">
    <title>{{ $doc['number'] }}</title>
    <style>
        @page { margin: 28mm 18mm; }
        * { font-family: sarabun, sans-serif; }
        body { color: #0f172a; font-size: 12px; margin: 0; }
        .muted { color: #64748b; font-size: 10px; }
        .brand { color: #16a34a; font-size: 20px; font-weight: bold; }
        .right { text-align: right; }
        table { width: 100%; border-collapse: collapse; }
        td { vertical-align: top; }
        .party { background: #f8fafc; padding: 10px; }
        .party td { padding: 0; }
        .items th { text-align: left; border-bottom: 1px solid #cbd5e1; padding: 7px 3px; font-size: 10px; color: #64748b; font-weight: normal; }
        .items td { border-bottom: 1px solid #e2e8f0; padding: 8px 3px; }
        .totals { width: 46%; margin-left: auto; }
        .totals td { padding: 4px 3px; }
        .grand td { border-top: 2px solid #0f172a; font-size: 15px; font-weight: bold; padding-top: 8px; }
        .grand .v { color: #16a34a; }
        .paid { background: #ecfdf5; color: #047857; padding: 7px 10px; font-weight: bold; }
        .foot { margin-top: 34px; color: #64748b; font-size: 10px; }
    </style>
</head>
<body>

<table>
    <tr>
        <td>
            <div class="brand">{{ $doc['seller']['name'] }}</div>
            <div class="muted">{{ $doc['title'] }} / {{ $doc['titleEn'] }}</div>
        </td>
        <td class="right" style="width: 40%;">
            <div style="font-weight: bold;">{{ $doc['titleEn'] }}</div>
            <div class="muted">{{ $doc['number'] }}</div>
            @if ($doc['reference'])
                <div class="muted">อ้างอิง {{ $doc['reference'] }}</div>
            @endif
        </td>
    </tr>
</table>

@if ($doc['kind'] === 'receipt')
    <p class="paid">ชำระแล้ว{{ $doc['paidDate'] ? ' เมื่อ '.$doc['paidDate'] : '' }}</p>
@endif

<table style="margin-top: 14px;">
    <tr>
        @foreach ([['ผู้ให้บริการ', $doc['seller']], [$doc['kind'] === 'receipt' ? 'ได้รับเงินจาก' : 'เรียกเก็บจาก', $doc['buyer']]] as $i => $block)
            <td style="width: 50%; {{ $i === 0 ? 'padding-right: 6px;' : 'padding-left: 6px;' }}">
                <table class="party">
                    <tr><td class="muted">{{ $block[0] }}</td></tr>
                    <tr><td style="font-weight: bold; padding-top: 2px;">{{ $block[1]['name'] }}</td></tr>
                    @if (!empty($block[1]['taxId']))
                        <tr><td class="muted">เลขประจำตัวผู้เสียภาษี {{ $block[1]['taxId'] }}</td></tr>
                    @endif
                    @if (!empty($block[1]['branch']))
                        <tr><td class="muted">{{ $block[1]['branch'] }}</td></tr>
                    @endif
                    @if (!empty($block[1]['address']))
                        <tr><td class="muted">{{ $block[1]['address'] }}</td></tr>
                    @endif
                </table>
            </td>
        @endforeach
    </tr>
</table>

<table style="margin-top: 14px;">
    <tr>
        <td style="width: 50%;">
            <div class="muted">{{ $doc['kind'] === 'receipt' ? 'วันที่ออกใบเสร็จ' : 'วันที่ออก' }}</div>
            <div>{{ $doc['issueDate'] ?: '—' }}</div>
        </td>
        <td>
            <div class="muted">{{ $doc['kind'] === 'receipt' ? 'ชำระเมื่อ' : 'ครบกำหนด' }}</div>
            <div>{{ ($doc['kind'] === 'receipt' ? $doc['paidDate'] : $doc['dueDate']) ?: '—' }}</div>
        </td>
    </tr>
</table>

<table class="items" style="margin-top: 12px;">
    <thead>
        <tr><th>รายการ</th><th class="right">จำนวน</th></tr>
    </thead>
    <tbody>
        @foreach ($doc['lines'] as $line)
            <tr>
                <td>{{ $line['description'] }}</td>
                <td class="right">{{ $money($line['amount']) }}</td>
            </tr>
        @endforeach
    </tbody>
</table>

<table class="totals" style="margin-top: 10px;">
    @if ($doc['vatRate'] > 0)
        <tr>
            <td class="muted">มูลค่าก่อนภาษี</td>
            <td class="right">{{ $money($doc['subtotal']) }}</td>
        </tr>
        <tr>
            <td class="muted">ภาษีมูลค่าเพิ่ม {{ rtrim(rtrim(number_format($doc['vatRate'], 2), '0'), '.') }}%</td>
            <td class="right">{{ $money($doc['vatAmount']) }}</td>
        </tr>
    @endif
    <tr class="grand">
        <td>ยอดรวม</td>
        <td class="right v">{{ $money($doc['total']) }}</td>
    </tr>
    @if ($doc['vatInclusive'])
        <tr><td colspan="2" class="muted">* ราคารวมภาษีมูลค่าเพิ่มแล้ว</td></tr>
    @endif
</table>

<div class="foot">ขอบคุณที่ใช้บริการ SanamSpace</div>

</body>
</html>
