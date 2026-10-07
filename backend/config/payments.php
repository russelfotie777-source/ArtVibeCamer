<?php

use App\Services\Payments\Drivers\ElgiopayGateway;
use App\Services\Payments\Drivers\FakeGateway;

return [

    /*
    |---------------------------------------------------------------------------
    | Passerelle active
    |---------------------------------------------------------------------------
    | `fake` encaisse sans appel reseau : c'est le driver de developpement et
    | de test, il permet de derouler tout le parcours sans credentials.
    | Il est refuse en production par PaymentManager.
    */

    'driver' => env('PAYMENT_DRIVER', 'fake'),

    'currency' => env('PAYMENT_CURRENCY', 'XAF'),

    /*
    | Delai laisse au payeur pour valider sur son telephone. Passe ce delai la
    | transaction est marquee `expired` et la jauge de tickets est liberee.
    */
    'payment_timeout_minutes' => (int) env('PAYMENT_TIMEOUT_MINUTES', 15),

    /*
    | Intervalle minimal entre deux verifications d'une meme transaction
    | aupres de la passerelle. L'ecran d'attente interroge notre API bien plus
    | souvent que cela ; seule une interrogation sur N atteint la passerelle.
    */
    'verification_interval_seconds' => (int) env('PAYMENT_VERIFICATION_INTERVAL', 25),

    /*
    | Bornes de montant, garde-fou contre une erreur de saisie ou une
    | manipulation du formulaire cote client.
    */
    'min_amount' => 100,
    'max_amount' => 5_000_000,

    'drivers' => [

        'fake' => [
            'class' => FakeGateway::class,
            // Simule un echec pour les numeros finissant par ce chiffre,
            // afin de pouvoir tester le parcours "paiement refuse".
            'failing_phone_suffix' => '0',
        ],

        /*
         * Elgiopay — collecte MTN MoMo et Orange Money.
         *
         * Le parcours est asynchrone : on declenche la collecte, l'operateur
         * envoie une demande de code au payeur, et Elgiopay notifie le
         * resultat sur notre webhook. La transaction reste donc `processing`
         * quelques dizaines de secondes.
         *
         * L'URL de notification se configure dans le tableau de bord
         * Elgiopay, et non par requete :
         *   https://<domaine>/api/v1/webhooks/payments/elgiopay
         */
        'elgiopay' => [
            'class' => ElgiopayGateway::class,

            // sandbox-api.elgiopay.com pour les tests, api.elgiopay.com en
            // production. L'API refuse tout autre sous-domaine.
            'base_url' => env('ELGIOPAY_BASE_URL', 'https://sandbox-api.elgiopay.com'),

            // pk_test_... en bac a sable, pk_live_... en production.
            'api_key' => env('ELGIOPAY_API_KEY'),

            // whsec_... Affiche une seule fois a la creation et a chaque
            // rotation : sans lui, aucune notification n'est acceptee.
            'webhook_secret' => env('ELGIOPAY_WEBHOOK_SECRET'),

            // Tolerance sur l'horodatage de signature, en secondes.
            // Au-dela, la notification est traitee comme un rejeu.
            'signature_tolerance' => (int) env('ELGIOPAY_SIGNATURE_TOLERANCE', 300),

            /*
             * Plafond d'appels sortants, toutes requetes confondues et tous
             * processus confondus. La passerelle est un service partage :
             * au-dela, on attend plutot que de la saturer.
             */
            'requetes_par_seconde' => (int) env('ELGIOPAY_MAX_RPS', 4),
        ],

    ],

    /*
    |---------------------------------------------------------------------------
    | Limitation du nombre de votes par achat
    |---------------------------------------------------------------------------
    */

    'votes' => [
        'min_quantity' => 1,
        'max_quantity' => (int) env('VOTE_MAX_QUANTITY', 1000),
    ],

];
