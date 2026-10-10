<?php

namespace App\Services\Ticketing;

use App\Enums\ScanResult;
use App\Models\Ticket;

final readonly class ScanOutcome
{
    public function __construct(
        public ScanResult $result,
        public ?Ticket $ticket = null,
    ) {}

    public function granted(): bool
    {
        return $this->result->grantsEntry();
    }
}
