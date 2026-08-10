<?php

namespace App\Http\Controllers\Api\Owner;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\LineMessageTemplate;
use App\Models\Organization;
use App\Models\OrganizationSetting;
use App\Services\LineMessagingService;
use App\Support\DefaultLineTemplates;
use App\Support\LineFlexRenderer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The venue's LINE reply templates — the receipt shown on booking, the payment
 * note, the cancellation card. The owner arranges each as a block tree in the
 * builder; this is where those trees are read, saved, and test-sent.
 *
 * A venue that has never opened the builder still has working messages: reads
 * fall back to the code default (DefaultLineTemplates), so `index` always
 * returns all three events with something editable.
 */
class LineTemplateController extends Controller
{
    public function __construct(
        private DefaultLineTemplates $defaults,
        private LineFlexRenderer $renderer,
        private LineMessagingService $line,
    ) {}

    /** GET /owner/line-templates — all three events, saved-or-default. */
    public function index(Request $request): JsonResponse
    {
        $org = $this->currentOrganization($request);

        $saved = LineMessageTemplate::query()
            ->where('organization_id', $org->id)
            ->get()
            ->keyBy('event');

        $data = collect(LineMessageTemplate::EVENTS)->map(function (string $event) use ($saved) {
            $row = $saved->get($event);

            return [
                'event' => $event,
                'enabled' => $row ? (bool) $row->enabled : $this->defaults->enabledByDefault($event),
                'blocks' => $row && $row->blocks ? $row->blocks : $this->defaults->blocks($event),
                'altText' => $this->defaults->altText($event),
                // Whether the venue has customised this one, or is on the default.
                'isCustom' => (bool) ($row && $row->blocks),
            ];
        })->values();

        return response()->json(['data' => $data]);
    }

    /** PUT /owner/line-templates/{event} — save the block tree + on/off. */
    public function update(Request $request, string $event): JsonResponse
    {
        $org = $this->currentOrganization($request);
        abort_unless(in_array($event, LineMessageTemplate::EVENTS, true), 404);

        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'blocks' => ['present', 'array'],
            'blocks.*.type' => ['required', 'string', Rule::in([
                'image', 'logo', 'title', 'text', 'divider', 'infoRow', 'button', 'buttonRow',
            ])],
        ]);

        // Persist the raw blocks, not the validated copy: validate() keeps only
        // the keys it has rules for (here just each block's `type`) and would
        // drop every other prop — text, color, url, the whole payload.
        $template = LineMessageTemplate::query()->updateOrCreate(
            ['organization_id' => $org->id, 'event' => $event],
            ['enabled' => $data['enabled'], 'blocks' => $request->input('blocks')],
        );

        return response()->json([
            'data' => [
                'event' => $event,
                'enabled' => (bool) $template->enabled,
                'blocks' => $template->blocks ?? [],
                'altText' => $this->defaults->altText($event),
                'isCustom' => (bool) $template->blocks,
            ],
        ]);
    }

    /**
     * POST /owner/line-templates/{event}/test — render the template (the
     * unsaved blocks if supplied, else what is stored) with sample values and
     * push it to one customer, so the owner can see the real card in LINE.
     */
    public function test(Request $request, string $event): JsonResponse
    {
        $org = $this->currentOrganization($request);
        abort_unless(in_array($event, LineMessageTemplate::EVENTS, true), 404);

        $data = $request->validate([
            'customerId' => ['required', 'string', Rule::exists('customers', 'id')->where('organization_id', $org->id)],
            'blocks' => ['sometimes', 'array'],
        ]);

        $customer = Customer::query()->forOrganization($org->id)->findOrFail($data['customerId']);

        $blocks = $data['blocks']
            ?? LineMessageTemplate::query()->where('organization_id', $org->id)->where('event', $event)->value('blocks')
            ?? $this->defaults->blocks($event);

        $vars = array_merge($this->defaults->sampleVars(), ['venueName' => $org->name]);
        $bubble = $this->renderer->render($blocks, $vars);
        $altText = $this->renderer->substitute($this->defaults->altText($event), $vars);

        $settings = OrganizationSetting::query()->where('organization_id', $org->id)->first();
        $outcome = $this->line->pushFlex($settings, $customer, $altText, $bubble);

        return response()->json(['data' => ['outcome' => $outcome]], $outcome === 'sent' ? 200 : 422);
    }

    private function currentOrganization(Request $request): Organization
    {
        return Organization::query()->findOrFail($request->attributes->get('currentOrganizationId'));
    }
}
