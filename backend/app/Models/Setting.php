<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

class Setting extends Model
{
    protected $fillable = ['key', 'value', 'type', 'group', 'label', 'is_public'];

    protected function casts(): array
    {
        return ['is_public' => 'boolean'];
    }

    private const CACHE_KEY = 'settings.all';

    /** Les reglages sont lus a chaque requete publique : on les garde en cache. */
    protected static function booted(): void
    {
        static::saved(fn () => Cache::forget(self::CACHE_KEY));
        static::deleted(fn () => Cache::forget(self::CACHE_KEY));
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        $row = self::cached()[$key] ?? null;

        return $row === null ? $default : self::cast($row['value'], $row['type']);
    }

    public static function put(string $key, mixed $value, string $type = 'string'): void
    {
        self::updateOrCreate(
            ['key' => $key],
            ['value' => is_array($value) ? json_encode($value) : (string) $value, 'type' => $type],
        );
    }

    /** @return array<string, mixed> Reglages exposables au front public. */
    public static function publicPayload(): array
    {
        $payload = [];

        foreach (self::cached() as $key => $row) {
            if ($row['is_public']) {
                $payload[$key] = self::cast($row['value'], $row['type']);
            }
        }

        return $payload;
    }

    /**
     * Les reglages sont caches sous forme de tableau associatif, et non de
     * Collection.
     *
     * Un objet serialise porte des octets NUL pour marquer ses proprietes
     * protegees, et ces octets ne survivent pas a un aller-retour dans la
     * colonne texte du cache base de donnees : la valeur relue devient un
     * __PHP_Incomplete_Class. Un tableau scalaire se serialise sans octet
     * nul et reste donc valable quel que soit le driver de cache.
     *
     * @return array<string, array{value: ?string, type: string, is_public: bool}>
     */
    private static function cached(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, function (): array {
            $rows = [];

            foreach (self::query()->get(['key', 'value', 'type', 'is_public']) as $setting) {
                $rows[$setting->key] = [
                    'value' => $setting->value,
                    'type' => $setting->type,
                    'is_public' => (bool) $setting->is_public,
                ];
            }

            return $rows;
        });
    }

    private static function cast(?string $value, string $type): mixed
    {
        if ($value === null) {
            return null;
        }

        return match ($type) {
            'integer' => (int) $value,
            'boolean' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
            'json' => json_decode($value, true),
            'datetime' => Carbon::parse($value),
            default => $value,
        };
    }
}
