<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesOrganization;
use App\Http\Controllers\Controller;
use App\Http\Resources\RentalItemResource;
use App\Services\RentalService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * What a customer can rent, for the slot they are about to book.
 *
 * Public alongside the rest of the booking screen's reads, and always answered
 * for a specific window — availability without a time is not an answer.
 */
class RentalController extends Controller
{
    use ResolvesOrganization;

    public function index(Request $request, RentalService $rentals): AnonymousResourceCollection
    {
        $data = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'start' => ['required', 'date_format:H:i'],
            'end' => ['required', 'date_format:H:i', 'after:start'],
        ]);

        $org = $this->resolveOrganizationOrFail($request);
        $hours = $this->hoursBetween($data['start'], $data['end']);

        return RentalItemResource::collection(
            $rentals->offer($org->id, $data['date'], $data['start'], $data['end'], $hours),
        );
    }

    private function hoursBetween(string $start, string $end): float
    {
        [$sh, $sm] = array_map('intval', explode(':', $start));
        [$eh, $em] = array_map('intval', explode(':', $end));

        return max(0, (($eh * 60 + $em) - ($sh * 60 + $sm)) / 60);
    }
}
