<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Setting::query()
                ->orderBy('group')
                ->orderBy('key')
                ->get(['key', 'value', 'type', 'group', 'label', 'is_public']),
        ]);
    }

    /**
     * Mise a jour groupee des reglages de l'evenement.
     *
     * Permet d'ouvrir ou fermer les votes, publier les resultats ou suspendre
     * les inscriptions sans redeployer, ce qui compte le jour J.
     */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'settings' => ['required', 'array', 'min:1'],
            'settings.*.key' => ['required', 'string', 'max:120'],
            'settings.*.value' => ['present'],
        ]);

        $changed = [];

        foreach ($data['settings'] as $entry) {
            $setting = Setting::where('key', $entry['key'])->first();

            // On ne cree pas de cle a la volee : un reglage inconnu serait
            // ignore par le code et donnerait l'illusion d'avoir agi.
            if ($setting === null) {
                continue;
            }

            $value = is_array($entry['value'])
                ? json_encode($entry['value'])
                : (is_bool($entry['value']) ? ($entry['value'] ? '1' : '0') : (string) $entry['value']);

            if ($setting->value !== $value) {
                $changed[$entry['key']] = ['before' => $setting->value, 'after' => $value];
                $setting->update(['value' => $value]);
            }
        }

        if ($changed !== []) {
            Audit::log('settings.updated', null, 'Reglages de l\'evenement modifies', $changed);
        }

        return response()->json([
            'message' => $changed === []
                ? 'Aucun changement.'
                : count($changed).' reglage(s) mis a jour.',
            'changed' => array_keys($changed),
            'data' => Setting::query()->orderBy('group')->orderBy('key')->get(['key', 'value', 'type', 'group', 'label', 'is_public']),
        ]);
    }
}
