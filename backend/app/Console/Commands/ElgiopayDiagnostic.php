<?php

namespace App\Console\Commands;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Transaction;
use App\Services\Payments\Drivers\ElgiopayGateway;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

/**
 * Deroule le bac a sable Elgiopay de bout en bout.
 *
 * Porte sur ce que les tests automatises ne peuvent pas couvrir : les
 * identifiants sont-ils bons, les chemins existent-ils vraiment, et leurs
 * etats correspondent-ils a ceux que nous attendons. Les tests, eux,
 * simulent les reponses HTTP — ils valident notre logique, pas leur API.
 *
 * Aucune ligne n'est ecrite en base : les transactions sont construites en
 * memoire et le service de paiement n'est pas sollicite, pour ne pas gonfler
 * les recettes du tableau de bord avec des essais.
 */
class ElgiopayDiagnostic extends Command
{
    protected $signature = 'elgiopay:diagnostic
                            {--rapide : Ignore les numeros a confirmation differee}
                            {--scenario= : Ne joue qu\'un numero, au lieu de la batterie}
                            {--attente=150 : Duree maximale d\'attente par scenario, en secondes}';

    protected $description = 'Verifie l\'integration Elgiopay contre leur bac a sable';

    /**
     * Numeros reserves par le simulateur. Les deux plages se comportent de
     * facon identique, on couvre donc un numero de chaque operateur sur le
     * succes immediat, puis MTN seul pour les autres cas.
     *
     * `bloquant` distingue ce qui empeche une mise en production de ce qui
     * revele seulement une lacune de leur simulateur.
     *
     * Les quatre motifs d'echec et les confirmations differees ne
     * fonctionnaient pas le 7 octobre 2026 ; signales a Elgiopay, ils ont ete
     * corriges le 8. Tous les scenarios sont donc bloquants : chacun verifie
     * desormais un comportement reellement simule, et un ecart signale une
     * regression — chez eux ou chez nous.
     *
     * @var array<int, array{numero: string, attendu: string, delai: int, libelle: string, bloquant: bool}>
     */
    private const SCENARIOS = [
        ['numero' => '677000000', 'attendu' => 'succeeded', 'delai' => 0, 'libelle' => 'MTN — succès immédiat', 'bloquant' => true],
        ['numero' => '699000000', 'attendu' => 'succeeded', 'delai' => 0, 'libelle' => 'Orange — succès immédiat', 'bloquant' => true],
        ['numero' => '677000010', 'attendu' => 'succeeded', 'delai' => 10, 'libelle' => 'MTN — succès après 10 s', 'bloquant' => true],
        ['numero' => '699000060', 'attendu' => 'succeeded', 'delai' => 60, 'libelle' => 'Orange — succès après 1 min', 'bloquant' => true],
        ['numero' => '677000201', 'attendu' => 'failed', 'delai' => 0, 'libelle' => 'Refus du payeur (9201)', 'bloquant' => true],
        ['numero' => '677000202', 'attendu' => 'failed', 'delai' => 0, 'libelle' => 'Solde insuffisant (9202)', 'bloquant' => true],
        ['numero' => '677000203', 'attendu' => 'failed', 'delai' => 0, 'libelle' => 'Pas validé à temps (9203)', 'bloquant' => true],
        ['numero' => '677000204', 'attendu' => 'failed', 'delai' => 0, 'libelle' => 'Échec générique (9204)', 'bloquant' => true],
    ];

    public function handle(): int
    {
        $config = config('payments.drivers.elgiopay');

        if (blank($config['api_key'] ?? null)) {
            $this->components->error('ELGIOPAY_API_KEY est vide.');
            $this->line('  Renseignez votre clé pk_test_… dans backend/.env, puis relancez.');

            return self::FAILURE;
        }

        $cle = (string) $config['api_key'];
        $horsLigne = str_starts_with($cle, 'pk_live_');

        $this->components->twoColumnDetail('Hôte', (string) $config['base_url']);
        $this->components->twoColumnDetail('Clé', Str::limit($cle, 12, '…'));
        $this->components->twoColumnDetail(
            'Secret de signature',
            blank($config['webhook_secret'] ?? null) ? 'absent' : 'présent',
        );
        $this->newLine();

        if ($horsLigne) {
            $this->components->warn(
                'Clé de production détectée. Ce diagnostic déclenche de vrais débits : interrompez si ce n\'est pas voulu.'
            );

            if (! $this->confirm('Continuer malgré tout ?', false)) {
                return self::FAILURE;
            }
        }

        /*
         * Compteur d'appels sortants. Un diagnostic doit pouvoir annoncer ce
         * qu'il consomme : c'est la seule facon de repondre precisement a un
         * fournisseur qui signale une charge excessive.
         */
        $appels = 0;
        Http::globalRequestMiddleware(function ($requete) use (&$appels) {
            $appels++;

            return $requete;
        });

        $passerelle = new ElgiopayGateway($config);

        /*
         * Controle prealable sur une lecture authentifiee. Sans lui, une cle
         * refusee ferait echouer tous les appels, et les scenarios qui
         * attendent justement un echec s'afficheraient « OK » — un faux
         * positif qui donnerait une integration pour bonne alors qu'elle ne
         * s'authentifie meme pas.
         */
        $solde = $passerelle->balance((string) config('payments.currency'));

        if ($solde === null) {
            $this->components->error('La clé est refusée par Elgiopay.');
            $this->line('  Vérifiez ELGIOPAY_API_KEY et ELGIOPAY_BASE_URL.');
            $this->line('  Une clé pk_test_… ne fonctionne que sur sandbox-api.elgiopay.com,');
            $this->line('  et une clé pk_live_… que sur api.elgiopay.com.');

            return self::FAILURE;
        }

        $format = fn (int $m) => number_format($m, 0, ',', ' ').' '.$solde['currency'];

        $this->components->twoColumnDetail('Solde disponible', $format($solde['available']));
        $this->components->twoColumnDetail('En attente de libération', $format($solde['pending']));
        $this->newLine();

        $attenteMax = (int) $this->option('attente');
        $lignes = [];
        $echecs = 0;
        $nonSimules = 0;

        $choisi = $this->option('scenario');
        $premier = true;

        foreach (self::SCENARIOS as $scenario) {
            if ($choisi !== null && $scenario['numero'] !== $choisi) {
                continue;
            }

            if ($choisi === null && $this->option('rapide') && $scenario['delai'] > 0) {
                continue;
            }

            // Respiration entre deux scenarios : une batterie ne doit pas
            // arriver en rafale chez le fournisseur.
            if (! $premier) {
                sleep(2);
            }
            $premier = false;

            [$ligne, $conforme] = $this->jouer($passerelle, $scenario, $attenteMax);
            $lignes[] = $ligne;

            if ($conforme) {
                continue;
            }

            if ($scenario['bloquant']) {
                $echecs++;
            } else {
                $nonSimules++;
            }
        }

        $this->newLine();

        if ($lignes === []) {
            $this->components->error('Aucun scénario ne correspond à --scenario.');

            return self::FAILURE;
        }

        $this->table(
            ['Scénario', 'Numéro', 'Attendu', 'Obtenu', 'Motif', ''],
            $lignes,
        );

        $this->newLine();
        $this->components->twoColumnDetail(
            'Appels adressés à Elgiopay',
            (string) $appels,
        );
        $this->newLine();

        if ($nonSimules > 0) {
            $this->components->warn(
                "{$nonSimules} scénario(s) ne correspondent pas à la documentation, sans bloquer la mise en service."
            );
            $this->line('  À signaler à Elgiopay avec le numéro concerné et la réponse obtenue.');
            $this->newLine();
        }

        if ($echecs > 0) {
            $this->components->error("{$echecs} encaissement(s) n'aboutissent pas.");
            $this->line('  Vérifiez la clé et l\'hôte avant toute mise en service.');

            return self::FAILURE;
        }

        $this->components->info('Les encaissements aboutissent sur les deux opérateurs.');
        $this->line('  Reste à valider le webhook : il demande une URL publique');
        $this->line('  (tunnel ngrok ou cloudflared) déclarée dans le tableau de bord Elgiopay.');

        return self::SUCCESS;
    }

    /** @return array{0: array<int, string>, 1: bool} */
    private function jouer(ElgiopayGateway $passerelle, array $scenario, int $attenteMax): array
    {
        $this->components->task(
            "{$scenario['libelle']} ({$scenario['numero']})",
            function () use ($passerelle, $scenario, $attenteMax, &$resultat) {
                $resultat = $this->executer($passerelle, $scenario, $attenteMax);

                return $resultat['conforme'];
            },
        );

        return [[
            $scenario['libelle'],
            $scenario['numero'],
            $scenario['attendu'],
            $resultat['obtenu'],
            Str::limit($resultat['motif'] ?? '—', 42),
            $resultat['conforme'] ? 'OK' : 'ÉCART',
        ], $resultat['conforme']];
    }

    private function executer(ElgiopayGateway $passerelle, array $scenario, int $attenteMax): array
    {
        // Transaction construite en memoire : rien n'est persiste.
        $transaction = new Transaction([
            'reference' => Transaction::generateReference(TransactionType::Registration),
            'type' => TransactionType::Registration,
            'amount' => 8000,
            'currency' => config('payments.currency'),
            'payer_name' => 'Diagnostic ArtVibeCamer',
            'payer_phone' => $scenario['numero'],
        ]);
        $transaction->type = TransactionType::Registration;
        $transaction->status = TransactionStatus::Processing;

        try {
            $intention = $passerelle->initiate($transaction);
        } catch (Throwable $e) {
            return [
                'obtenu' => 'exception',
                'motif' => $e->getMessage(),
                'conforme' => false,
            ];
        }

        $statut = $intention->status;
        $motif = $intention->failureReason;

        if ($intention->providerReference !== null) {
            $transaction->provider_reference = $intention->providerReference;
        }

        // Les numeros a delai repondent d'abord « pending » : on interroge
        // jusqu'a ce que l'horloge franchisse l'heure de confirmation.
        $limite = microtime(true) + min($attenteMax, max(20, $scenario['delai'] + 45));

        while (! $statut->isFinal() && microtime(true) < $limite) {
            // Cinq secondes entre deux interrogations : un diagnostic ne doit
            // pas peser plus lourd sur la passerelle qu'un usage reel.
            usleep(5_000_000);

            $etat = $passerelle->verify($transaction);
            $statut = $etat->status;
            $motif = $etat->failureReason ?? $motif;

            if ($etat->providerReference !== null) {
                $transaction->provider_reference = $etat->providerReference;
            }
        }

        return [
            'obtenu' => $statut->value,
            'motif' => $motif,
            'conforme' => $statut->value === $scenario['attendu'],
        ];
    }
}
