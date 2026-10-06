<?php

namespace App\Http\Controllers\Api\V1\Site;

use App\Http\Controllers\Controller;
use App\Models\Setting;

class SettingController extends Controller
{
    /** Reglages exposables au front : nom, dates, interrupteurs d'ouverture. */
    public function index()
    {
        return response()->json([
            'data' => Setting::publicPayload(),
        ]);
    }
}
