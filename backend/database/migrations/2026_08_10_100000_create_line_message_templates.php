<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The LINE Flex message a venue sends its customer on a booking event —
        // the receipt card, the payment note, the cancellation notice. `flex`
        // is the block tree the owner arranges in the builder; the renderer
        // turns it into LINE Flex JSON at send time. A venue with no row for an
        // event falls back to the default template baked into the code, so the
        // feature works before anyone touches the builder.
        Schema::create('line_message_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            // booking_confirmed | payment_received | booking_cancelled
            $table->string('event', 40);
            $table->boolean('enabled')->default(true);
            // The ordered block tree ([{type, ...props}, ...]). Rendered to LINE
            // Flex on send; null means "use the code default for this event".
            $table->json('blocks')->nullable();
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            // One template per event per venue.
            $table->unique(['organization_id', 'event']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('line_message_templates');
    }
};
