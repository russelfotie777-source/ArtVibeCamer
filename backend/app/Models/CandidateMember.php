<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class CandidateMember extends Model
{
    protected $fillable = ['candidate_id', 'full_name', 'photo_path', 'position'];

    protected $appends = ['photo_url'];

    protected function casts(): array
    {
        return ['position' => 'integer'];
    }

    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }

    public function getPhotoUrlAttribute(): ?string
    {
        return $this->photo_path ? Storage::disk('public')->url($this->photo_path) : null;
    }
}
