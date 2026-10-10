<?php

namespace App\Services\Payments;

use Illuminate\Support\Facades\Cache;

/**
 * Plafond de cadence sur les appels sortants vers une passerelle.
 *
 * Une passerelle de paiement est un service partage : la saturer degrade le
 * service de tous ses clients, et finit par nous faire bloquer. Le compteur
 * vit dans le cache, donc il est commun a tous les processus PHP — un
 * compteur en memoire ne verrait que son propre worker et laisserait passer
 * autant de fois la limite qu'il y a de workers.
 *
 * Quand le plafond est atteint, on attend la seconde suivante plutot que
 * d'echouer : un encaissement differe d'une seconde reste un encaissement,
 * un encaissement abandonne est un candidat perdu.
 */
class CadenceSortante
{
    public function __construct(
        private readonly string $passerelle,
        private readonly int $parSeconde,
        /** Nombre de secondes d'attente au-dela duquel on renonce. */
        private readonly int $attenteMax = 5,
    ) {}

    public function attendreSonTour(): void
    {
        if ($this->parSeconde < 1) {
            return;
        }

        $limite = microtime(true) + $this->attenteMax;

        while (microtime(true) < $limite) {
            if ($this->reserver()) {
                return;
            }

            // Reprend au debut de la seconde suivante, avec un petit decalage
            // aleatoire : sans lui, tous les processus en attente repartiraient
            // au meme instant et se bousculeraient a nouveau.
            $reste = 1 - (microtime(true) - floor(microtime(true)));
            usleep((int) (($reste * 1_000_000) + random_int(5_000, 60_000)));
        }

        // Plafond tenu plus longtemps que prevu : on laisse passer plutot que
        // de bloquer indefiniment un candidat devant son telephone.
    }

    private function reserver(): bool
    {
        $cle = sprintf('cadence:%s:%d', $this->passerelle, (int) floor(microtime(true)));

        // La cle expire d'elle-meme : aucun nettoyage a prevoir.
        Cache::add($cle, 0, 2);

        return Cache::increment($cle) <= $this->parSeconde;
    }
}
