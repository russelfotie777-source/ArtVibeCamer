<?php

namespace App\Services\Payments;

use App\Services\Payments\Drivers\FakeGateway;
use InvalidArgumentException;
use RuntimeException;

/**
 * Resout la passerelle a utiliser et garde en memoire les instances deja
 * construites. Le reste de l'application ne manipule que l'interface
 * PaymentGateway.
 */
class PaymentManager
{
    /** @var array<string, PaymentGateway> */
    private array $resolved = [];

    public function __construct(
        private readonly array $config,
        private readonly string $environment,
    ) {}

    public function default(): PaymentGateway
    {
        return $this->driver($this->config['driver'] ?? 'fake');
    }

    public function driver(string $name): PaymentGateway
    {
        if (isset($this->resolved[$name])) {
            return $this->resolved[$name];
        }

        $settings = $this->config['drivers'][$name] ?? null;

        if ($settings === null) {
            throw new InvalidArgumentException("Passerelle de paiement inconnue : [{$name}].");
        }

        /** @var PaymentGateway $gateway */
        $gateway = new $settings['class']($settings);

        // Garde-fou : la passerelle de simulation n'encaisse rien. L'activer en
        // production validerait des inscriptions, des votes et des billets
        // sans aucun paiement reel.
        if ($gateway instanceof FakeGateway && $this->environment === 'production') {
            throw new RuntimeException(
                'La passerelle de simulation est interdite en production. '
                .'Renseignez PAYMENT_DRIVER avec une passerelle reelle.'
            );
        }

        if (! $gateway->isConfigured()) {
            throw new RuntimeException(
                "Passerelle [{$name}] mal configuree : credentials manquants dans l'environnement."
            );
        }

        return $this->resolved[$name] = $gateway;
    }

    public function defaultName(): string
    {
        return $this->config['driver'] ?? 'fake';
    }

    /** Le driver actif simule-t-il les encaissements ? */
    public function isSimulated(): bool
    {
        return $this->defaultName() === 'fake';
    }
}
