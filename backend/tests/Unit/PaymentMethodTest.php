<?php

namespace Tests\Unit;

use App\Enums\PaymentMethod;
use PHPUnit\Framework\TestCase;

/**
 * Detection de l'operateur a partir du numero du payeur.
 *
 * Une erreur ici ne se voit pas a la relecture : la collecte part sur le
 * mauvais reseau et echoue chez l'operateur, pour tous les porteurs d'une
 * plage entiere. Les bornes sont donc verifiees une par une, y compris celles
 * ou MTN et Orange se touchent.
 */
class PaymentMethodTest extends TestCase
{
    public function test_les_plages_mtn_et_orange_sont_distinguees(): void
    {
        $cas = [
            // MTN : 67x, 650-654, 680-684.
            ['677000000', PaymentMethod::MtnMomo],
            ['671234567', PaymentMethod::MtnMomo],
            ['650000000', PaymentMethod::MtnMomo],
            ['654999999', PaymentMethod::MtnMomo],
            ['680000000', PaymentMethod::MtnMomo],
            ['684999999', PaymentMethod::MtnMomo],

            // Orange : 69x, 655-659, 685-689.
            ['699000000', PaymentMethod::OrangeMoney],
            ['696543210', PaymentMethod::OrangeMoney],
            ['655000000', PaymentMethod::OrangeMoney],
            ['659999999', PaymentMethod::OrangeMoney],
            ['685000000', PaymentMethod::OrangeMoney],
            ['689999999', PaymentMethod::OrangeMoney],
        ];

        foreach ($cas as [$numero, $operateur]) {
            $this->assertSame(
                $operateur,
                PaymentMethod::fromCameroonPhone($numero),
                "le numero {$numero} n'est pas attribue au bon operateur",
            );
        }
    }

    /**
     * Les deux plages se touchent sans trou ni recouvrement : 654 et 655,
     * 684 et 685. C'est la que se logerait une erreur de borne.
     */
    public function test_les_frontieres_entre_les_deux_reseaux_sont_nettes(): void
    {
        $this->assertSame(PaymentMethod::MtnMomo, PaymentMethod::fromCameroonPhone('654000000'));
        $this->assertSame(PaymentMethod::OrangeMoney, PaymentMethod::fromCameroonPhone('655000000'));
        $this->assertSame(PaymentMethod::MtnMomo, PaymentMethod::fromCameroonPhone('684000000'));
        $this->assertSame(PaymentMethod::OrangeMoney, PaymentMethod::fromCameroonPhone('685000000'));
    }

    public function test_le_format_international_est_accepte(): void
    {
        $this->assertSame(PaymentMethod::MtnMomo, PaymentMethod::fromCameroonPhone('237677000000'));
        $this->assertSame(PaymentMethod::OrangeMoney, PaymentMethod::fromCameroonPhone('+237 699 00 00 00'));
    }

    /**
     * Sans operateur identifie, mieux vaut refuser tout de suite que lancer
     * une collecte vouee a echouer apres coup chez l'operateur.
     */
    public function test_un_numero_hors_plage_n_est_attribue_a_personne(): void
    {
        foreach (['620000000', '600000000', '67700000', '6770000000', '', 'abcdefghi'] as $numero) {
            $this->assertNull(
                PaymentMethod::fromCameroonPhone($numero),
                "le numero « {$numero} » ne devrait etre attribue a aucun operateur",
            );
        }
    }
}
