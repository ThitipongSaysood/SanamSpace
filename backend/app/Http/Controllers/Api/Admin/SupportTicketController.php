<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminSupportTicketResource;
use App\Models\Organization;
use App\Models\SupportTicket;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Mail;

/**
 * The platform's support desk: read a venue's request, answer it, close it.
 *
 * A reply is both recorded on the thread AND emailed to the venue — venues have
 * no support inbox of their own, so an answer that lives only in this portal
 * has not actually reached anybody.
 */
class SupportTicketController extends Controller
{
    /** GET /admin/support-tickets — open ones first; that is the work queue. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $tickets = SupportTicket::query()
            ->with('replies')
            ->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))
            ->orderByRaw("CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END")
            ->orderByDesc('updated_at')
            ->get();

        return AdminSupportTicketResource::collection($tickets);
    }

    /** GET /admin/support-tickets/{id} — one ticket with its whole thread. */
    public function show(string $id): AdminSupportTicketResource
    {
        return new AdminSupportTicketResource(SupportTicket::with('replies')->findOrFail($id));
    }

    /**
     * POST /admin/support-tickets/{id}/replies { body } — answer the venue.
     *
     * Answering moves an untouched ticket to `pending` (waiting on them), so the
     * queue reflects who owes the next move.
     */
    public function reply(Request $request, string $id): AdminSupportTicketResource
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $ticket = SupportTicket::findOrFail($id);
        $author = $request->user()?->display_name ?: 'Platform Admin';

        $ticket->replies()->create([
            'author_name' => $author,
            'author_side' => 'platform',
            'body' => $data['body'],
            'emailed' => $this->emailReply($ticket, $data['body']),
        ]);

        if ($ticket->status === 'open') {
            $ticket->status = 'pending';
            $ticket->assigned_to = $ticket->assigned_to ?: $author;
        }
        $ticket->touch();
        $ticket->save();

        return new AdminSupportTicketResource($ticket->fresh()->load('replies'));
    }

    /**
     * PUT /admin/support-tickets/{id}/status { status, assignedTo? }.
     * Stamps resolved_at the first time it is settled, and clears it on reopen.
     */
    public function updateStatus(Request $request, string $id): AdminSupportTicketResource
    {
        $data = $request->validate([
            'status' => ['required', 'string', 'in:open,pending,resolved,closed'],
            'assignedTo' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $ticket = SupportTicket::findOrFail($id);
        $settled = in_array($data['status'], ['resolved', 'closed'], true);

        $ticket->status = $data['status'];
        if (array_key_exists('assignedTo', $data)) {
            $ticket->assigned_to = $data['assignedTo'];
        }
        // Keep the original settle time across a resolve → reopen → resolve.
        $ticket->resolved_at = $settled ? ($ticket->resolved_at ?: now()) : null;
        $ticket->save();

        return new AdminSupportTicketResource($ticket->fresh()->load('replies'));
    }

    /**
     * Email the answer to the venue's contact address.
     *
     * Returns false rather than throwing when there is nowhere to send or the
     * mailer fails — the reply is still worth recording, and the thread shows
     * that it did not go out.
     */
    private function emailReply(SupportTicket $ticket, string $body): bool
    {
        // By id where we have one. Matching on the name was the only option
        // while tickets carried nothing else, and it would mail the answer to
        // the wrong venue the day two venues are called the same thing.
        $org = $ticket->organization_id
            ? Organization::find($ticket->organization_id)
            : Organization::where('name', $ticket->organization_name)->first();

        $email = $org?->settings?->email;

        if (! $email) {
            return false;
        }

        $text = "เรียน {$ticket->organization_name}\n\n"
            ."เรื่อง: {$ticket->subject}\n"
            ."เลขที่: {$ticket->ticket_no}\n\n"
            ."{$body}\n\n"
            ."— ทีมสนับสนุน SanamSpace";

        try {
            Mail::raw($text, function ($m) use ($email, $ticket) {
                $m->to($email)->subject("[{$ticket->ticket_no}] {$ticket->subject} - SanamSpace");
            });
        } catch (\Throwable) {
            return false;
        }

        return true;
    }
}
