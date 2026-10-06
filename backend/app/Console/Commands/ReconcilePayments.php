<?php

namespace App\Console\Commands;

use App\Enums\TransactionStatus;
use App\Models\Transaction;
use App\Services\Payments\PaymentProcessor;
use App\Services\Payments\PaymentStatus;
use Illuminate\Console\Command;
use Throwable;

/**
 * Rattrape les paiements restes en suspens.
 *
 * Une notification de passerelle peut etre perdue : coupure reseau, serveur
 * momentanement indisponible, erreur applicative. Sans ce rattrapage, un
 * client debite ne recevrait jamais ses billets ou ses votes.
 *
 * Deux temps, dans cet ordre, et l'ordre importe :
 *  1. on redemande l'etat reel a la passerelle ;
 *  2. seules les transactions que la passerelle ne reconnait toujours pas
 *     comme payees, et dont le delai est largement depasse, sont expirees.
 * L'inverse expirerait des paiements reellement encaisses.
 */
class ReconcilePayments extends Command
{
    protected $signature = 'payments:reconcile
                            {--grace=10 : Minutes de marge au-dela de l\'expiration avant abandon}
                            {--limit=200 : Nombre maximum de transactions traitees}';

    protected $description = 'Verifie aupres des passerelles les paiements restes en attente';

    public function handle(PaymentProcessor $payments): int
    {
        $grace = (int) $this->option('grace');
        $limit = (int) $this->option('limit');

        $pending = Transaction::query()
            ->whereIn('status', [
                TransactionStatus::Pending->value,
                TransactionStatus::Processing->value,
            ])
            // Laisse au payeur le temps de saisir son code.
            ->where('created_at', '<', now()->subMinutes(2))
            ->orderBy('created_at')
            ->limit($limit)
            ->get();

        if ($pending->isEmpty()) {
            $this->info('Aucun paiement en attente.');

            return self::SUCCESS;
        }

        $this->info("{$pending->count()} paiement(s) a verifier.");

        $settled = 0;
        $expired = 0;
        $failures = 0;

        foreach ($pending as $transaction) {
            try {
                $fresh = $payments->refresh($transaction);

                if ($fresh->status->isFinal()) {
                    $settled++;
                    $this->line("  {$fresh->reference} -> {$fresh->status->label()}");

                    continue;
                }

                // Toujours pas payee et le delai est largement passe : on
                // libere la jauge de billets et on invalide les votes reserves.
                if ($fresh->expires_at !== null && $fresh->expires_at->lt(now()->subMinutes($grace))) {
                    $payments->applyStatus($fresh, new PaymentStatus(
                        status: TransactionStatus::Expired,
                        failureReason: 'Delai de paiement depasse.',
                    ));

                    $expired++;
                    $this->line("  {$fresh->reference} -> expiree");
                }
            } catch (Throwable $e) {
                $failures++;
                $this->error("  {$transaction->reference} : {$e->getMessage()}");
            }
        }

        $this->newLine();
        $this->info("Regles : {$settled} | Expirees : {$expired} | Erreurs : {$failures}");

        return self::SUCCESS;
    }
}
