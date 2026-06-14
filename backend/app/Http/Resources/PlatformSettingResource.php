<?php
namespace App\Http\Resources;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
class PlatformSettingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'platformName' => $this->platform_name,
            'supportEmail' => $this->support_email,
            'timezone' => $this->timezone,
            'currency' => $this->currency,
            'dateFormat' => $this->date_format,
            'language' => $this->language,
        ];
    }
}
