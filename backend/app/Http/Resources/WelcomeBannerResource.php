<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Owner-portal view of a WelcomeBanner.
 *
 * Shape: { id, title, message, imageUrl, link, isActive, popup, sortOrder }
 *
 * The customer app gets a narrower shape from OrganizationPublicController —
 * it has no business knowing about banners the venue switched off.
 */
class WelcomeBannerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'title' => $this->title,
            'message' => $this->message,
            'imageUrl' => $this->image_url,
            'link' => $this->link,
            'isActive' => (bool) $this->is_active,
            'popup' => (bool) $this->popup,
            'sortOrder' => (int) $this->sort_order,
        ];
    }
}
