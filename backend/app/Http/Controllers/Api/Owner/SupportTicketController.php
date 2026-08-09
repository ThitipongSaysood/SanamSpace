<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Http\Resources\OwnerSupportTicketResource;
use App\Models\Organization;
use App\Models\SupportTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * The venue's side of the support desk.
 *
 * The platform could read tickets, answer them and close them; nothing in the
 * codebase could create one. Every row in the inbox came from the seeder, and
 * the "ติดต่อฝ่ายสนับสนุน" link in the owner sidebar pointed at the settings
 * page. A venue with a problem had no way in at all.
 *
 * Scoped by organisation id rather than name — matching on the name would show
 * one venue another's conversation the day two venues are called the same
 * thing.
 */
class SupportTicketController extends Controller
{
    /** GET /owner/support-tickets — this venue's threads, newest activity first. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $tickets = SupportTicket::query()
            ->where('organization_id', $request->attributes->get('currentOrganizationId'))
            ->with('replies')
            ->orderByDesc('updated_at')
            ->get();

        return OwnerSupportTicketResource::collection($tickets);
    }

    /** POST /owner/support-tickets { subject, body, priority? } */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subject' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:5000'],
            'priority' => ['sometimes', 'string', 'in:low,medium,high'],
        ]);

        $org = Organization::findOrFail($request->attributes->get('currentOrganizationId'));

        $ticket = SupportTicket::create([
            'ticket_no' => $this->nextTicketNo(),
            'organization_id' => $org->id,
            'organization_name' => $org->name,
            'subject' => $data['subject'],
            'body' => $data['body'],
            'status' => 'open',
            'priority' => $data['priority'] ?? 'medium',
        ]);

        // The opening message is also the first entry in the thread, so the
        // conversation reads in one place instead of starting mid-sentence.
        $ticket->replies()->create([
            'author_name' => $this->authorName($request),
            'author_side' => 'organization',
            'body' => $data['body'],
            'emailed' => false,
        ]);

        return (new OwnerSupportTicketResource($ticket->fresh()->load('replies')))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * POST /owner/support-tickets/{id}/replies { body } — the venue answers back.
     *
     * A reply from the venue reopens a settled ticket: if they are still
     * talking, it is not resolved, and the platform's queue has to show that.
     */
    public function reply(Request $request, string $id): OwnerSupportTicketResource
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $ticket = SupportTicket::query()
            ->where('organization_id', $request->attributes->get('currentOrganizationId'))
            ->findOrFail($id);

        $ticket->replies()->create([
            'author_name' => $this->authorName($request),
            'author_side' => 'organization',
            'body' => $data['body'],
            'emailed' => false,
        ]);

        $ticket->status = 'open';
        $ticket->resolved_at = null;
        $ticket->touch();
        $ticket->save();

        return new OwnerSupportTicketResource($ticket->fresh()->load('replies'));
    }

    private function authorName(Request $request): string
    {
        return $request->user()?->display_name ?: ($request->user()?->name ?: 'สนาม');
    }

    /** TCK-{year}-{seq}, unique within the year. */
    private function nextTicketNo(): string
    {
        $year = now()->year;
        $seq = SupportTicket::query()->where('ticket_no', 'like', "TCK-{$year}-%")->count() + 1;

        do {
            $no = sprintf('TCK-%d-%04d', $year, $seq);
            $seq++;
        } while (SupportTicket::query()->where('ticket_no', $no)->exists());

        return $no;
    }
}
