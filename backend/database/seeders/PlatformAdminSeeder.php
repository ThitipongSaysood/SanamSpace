<?php

namespace Database\Seeders;

use App\Models\Announcement;
use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\PlatformSetting;
use App\Models\PlatformTransaction;
use App\Models\SupportTicket;
use Illuminate\Database\Seeder;

class PlatformAdminSeeder extends Seeder
{
    public function run(): void
    {
        $orgs = ['Everyday Badminton', 'TSR Badminton Club', 'NT Football Arena', 'Semitennis Club', 'The Racket Club'];

        $invoices = [
            ['INV-2026-0008', 'Everyday Badminton', 3900, 'paid', '2026-06-01', '2026-06-08'],
            ['INV-2026-0007', 'TSR Badminton Club', 5900, 'paid', '2026-06-01', '2026-06-08'],
            ['INV-2026-0006', 'NT Football Arena', 3900, 'paid', '2026-06-01', '2026-06-08'],
            ['INV-2026-0005', 'Semitennis Club', 0, 'unpaid', '2026-06-01', '2026-06-15'],
            ['INV-2026-0004', 'The Racket Club', 5900, 'overdue', '2026-05-01', '2026-05-08'],
        ];
        foreach ($invoices as [$no, $org, $amt, $st, $issue, $due]) {
            Invoice::create([
                'number' => $no, 'organization_name' => $org, 'amount' => $amt,
                'status' => $st, 'issue_date' => $issue, 'due_date' => $due,
                'paid_date' => $st === 'paid' ? $due : null,
            ]);
        }

        $txns = [
            ['Everyday Badminton', 'subscription', 3900, 'card', 'success'],
            ['TSR Badminton Club', 'subscription', 5900, 'transfer', 'success'],
            ['NT Football Arena', 'subscription', 3900, 'promptpay', 'success'],
            ['The Racket Club', 'subscription', 5900, 'card', 'pending'],
            ['Semitennis Club', 'topup', 1000, 'promptpay', 'failed'],
            ['Everyday Badminton', 'refund', 500, 'card', 'refunded'],
        ];
        foreach ($txns as $i => [$org, $type, $amt, $method, $st]) {
            PlatformTransaction::create([
                'organization_name' => $org, 'type' => $type, 'amount' => $amt,
                'method' => $method, 'status' => $st,
                'created_at' => now()->subHours($i * 7), 'updated_at' => now()->subHours($i * 7),
            ]);
        }

        $tickets = [
            ['TK-2026-0587', 'Everyday Badminton', 'เข้าระบบไม่ได้', 'open', 'high', 'Support Team'],
            ['TK-2026-0586', 'TSR Badminton Club', 'ขอเพิ่มสาขา', 'in_progress', 'medium', 'Support Team'],
            ['TK-2026-0585', 'NT Football Arena', 'ตั้งค่าการชำระเงิน', 'open', 'medium', null],
            ['TK-2026-0584', 'Semitennis Club', 'สอบถามการใช้งาน', 'resolved', 'low', 'Support Team'],
            ['TK-2026-0583', 'The Racket Club', 'ขอใบเสร็จ', 'closed', 'low', 'Finance Team'],
        ];
        foreach ($tickets as $i => [$no, $org, $subj, $st, $pri, $assignee]) {
            SupportTicket::create([
                'ticket_no' => $no, 'organization_name' => $org, 'subject' => $subj,
                'status' => $st, 'priority' => $pri, 'assigned_to' => $assignee,
                'updated_at' => now()->subHours($i * 5), 'created_at' => now()->subDays($i + 1),
            ]);
        }

        $announcements = [
            ['ปิดปรับปรุงระบบ 20 มิ.ย.', 'ระบบจะปิดปรับปรุงเวลา 02:00–04:00 น.', 'all', 'published'],
            ['ฟีเจอร์ใหม่: จัดการคอร์ทแบบลากวาง', 'อัปเดตตารางจองแบบ drag & drop แล้ว', 'paid', 'published'],
            ['โปรโมชั่นต่ออายุแพ็กเกจ', 'ลด 20% สำหรับการต่ออายุรายปี', 'trial', 'draft'],
        ];
        foreach ($announcements as $i => [$title, $body, $aud, $st]) {
            Announcement::create([
                'title' => $title, 'body' => $body, 'audience' => $aud, 'status' => $st,
                'published_at' => $st === 'published' ? now()->subDays($i + 1) : null,
            ]);
        }

        $logs = [
            ['Admin Super', 'Login', 'Login successful', '103.168.1.10'],
            ['Admin Super', 'Update Plan', 'Changed plan to Pro', '103.168.1.10'],
            ['Finance Team', 'Create Invoice', 'INV-2026-0008', '103.168.1.15'],
            ['Support Team', 'Update Ticket', 'TK-2026-0587', '103.168.1.20'],
            ['Developer', 'System Backup', 'Daily backup completed', '103.168.1.30'],
            ['Admin Super', 'Create User', 'Added new user', '103.168.1.10'],
        ];
        foreach ($logs as $i => [$user, $action, $detail, $ip]) {
            AuditLog::create([
                'user_name' => $user, 'action' => $action, 'detail' => $detail, 'ip_address' => $ip,
                'created_at' => now()->subHours($i * 3), 'updated_at' => now()->subHours($i * 3),
            ]);
        }

        PlatformSetting::firstOrCreate([], [
            'platform_name' => 'SanamSpace',
            'support_email' => 'support@sanamspace.com',
            'timezone' => 'Asia/Bangkok',
            'currency' => 'THB',
            'date_format' => 'DD/MM/YYYY',
            'language' => 'th',
        ]);
    }
}
