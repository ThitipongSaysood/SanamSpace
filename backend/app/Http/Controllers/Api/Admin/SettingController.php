<?php
namespace App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Controller;
use App\Http\Resources\PlatformSettingResource;
use App\Models\PlatformSetting;
use Illuminate\Http\Request;
class SettingController extends Controller
{
    public function show(): PlatformSettingResource
    {
        return new PlatformSettingResource(PlatformSetting::query()->firstOrCreate([]));
    }

    public function update(Request $request): PlatformSettingResource
    {
        $validated = $request->validate([
            'platformName' => ['sometimes', 'string', 'max:255'],
            'supportEmail' => ['sometimes', 'nullable', 'email', 'max:255'],
            'timezone' => ['sometimes', 'string', 'max:100'],
            'currency' => ['sometimes', 'string', 'max:10'],
            'dateFormat' => ['sometimes', 'string', 'max:30'],
            'language' => ['sometimes', 'string', 'max:10'],
        ]);
        $map = ['platformName'=>'platform_name','supportEmail'=>'support_email','timezone'=>'timezone','currency'=>'currency','dateFormat'=>'date_format','language'=>'language'];
        $setting = PlatformSetting::query()->firstOrCreate([]);
        $updates = [];
        foreach ($map as $f => $c) { if (array_key_exists($f, $validated)) $updates[$c] = $validated[$f]; }
        if ($updates) $setting->update($updates);
        return new PlatformSettingResource($setting->fresh());
    }
}
