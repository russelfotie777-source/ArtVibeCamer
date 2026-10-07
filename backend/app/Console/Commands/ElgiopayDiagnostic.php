<?php

namespace App\Console\Commands;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Transaction;
use App\Services\Payments\Drivers\ElgiopayGateway;
use Illuminate\Console\Command;
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
                            {--attente=150 : Duree maximale d\'attente par scenario, en secondes}';

    protected $description = 'Verifie l\'integration Elgiopay contre leur bac a sable';

    /**
     * Numeros reserves par le simulateur. Les deux plages se comportent de
     * facon identique, on couvre donc un numero de chaque operateur sur le
     * succes immediat, puis MTN seul pour les autres cas.
     *
     * @var array<int, array{numero: string, attendu: string, delai: int, libelle: string}>
     */
    private const SCENARIOS = [
        ['numero' => '677000000', 'attendu' => 'succeeded', 'delai' => 0, 'libelle' => 'MTN — succès immédiat'],
        ['numero' => '699000000', 'attendu' => 'succeeded', 'delai' => 0, 'libelle' => 'Orange — succès immédiat'],
        ['numero' => '677000010', 'attendu' => 'succeeded', 'delai' => 10, 'libelle' => 'MTN — succès après 10 s'],
        ['numero' => '699000060', 'attendu' => 'succeeded', 'delai' => 60, 'libelle' => 'Orange — succès après 1 min'],
        ['numero' => '677000201', 'attendu' => 'failed', 'delai' => 0, 'libelle' => 'Refus du payeur (9201)'],
        ['numero' => '677000202', 'attendu' => 'failed', 'delai' => 0, 'libelle' => 'Solde insuffisant (9202)'],
        ['numero' => '677000203', 'attendu' => 'failed', 'delai' => 0, 'libelle' => 'Pas validé à temps (9203)'],
        ['numero' => '677000204', 'attendu' => 'failed', 'delai' => 0, 'libelle' => 'Échec générique (9204)'],
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

        foreach (self::SCENARIOS as $scenario) {
            if ($this->option('rapide') && $scenario['delai'] > 0) {
                continue;
            }

            [$ligne, $conforme] = $this->jouer($passerelle, $scenario, $attenteMax);
            $lignes[] = $ligne;
            $echecs += $conforme ? 0 : 1;
        }

        $this->newLine();
        $this->table(
            ['Scénario', 'Numéro', 'Attendu', 'Obtenu', 'Motif', ''],
            $lignes,
        );

        $this->newLine();

        if ($echecs === 0) {
            $this->components->info('Tous les scénarios se comportent comme annoncé.');
            $this->line('  Reste à valider le webhook : il demande une URL publique');
            $this->line('  (tunnel ngrok ou cloudflared) déclarée dans le tableau de bord Elgiopay.');

            return self::SUCCESS;
        }

        $this->components->error("{$echecs} scénario(s) ne correspondent pas à la documentation.");
        $this->line('  Vérifiez la clé, l\'hôte, puis signalez l\'écart à Elgiopay.');

        return self::FAILURE;
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
            usleep(3_000_000);

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
