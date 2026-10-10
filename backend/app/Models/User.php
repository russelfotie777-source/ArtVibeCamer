<?php

namespace App\Models;

use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
        'role',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'is_active' => 'boolean',
        ];
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeRole(Builder $query, UserRole ...$roles): Builder
    {
        return $query->whereIn('role', array_map(fn (UserRole $r) => $r->value, $roles));
    }

    public function activityLogs()
    {
        return $this->hasMany(ActivityLog::class);
    }

    public function scans()
    {
        return $this->hasMany(ScanLog::class, 'scanned_by');
    }

    /**
     * Les capacites sont portees par l'enum UserRole : un seul endroit a lire
     * pour savoir qui peut faire quoi. Volontairement distinct de can() pour
     * ne pas interferer avec les policies de Gate.
     */
    public function hasCapability(string $capability): bool
    {
        return method_exists($this->role, $capability)
            && $this->role->{$capability}() === true;
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === UserRole::SuperAdmin;
    }

    public function canManage(): bool
    {
        return $this->role->canManage();
    }

    public function canModerate(): bool
    {
        return $this->role->canModerate();
    }

    public function canScan(): bool
    {
        return $this->role->canScan();
    }

    public function canAccessBackOffice(): bool
    {
        return $this->role->canAccessBackOffice();
    }

    public function recordLogin(?string $ip): void
    {
        $this->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $ip,
        ])->saveQuietly();
    }
}
