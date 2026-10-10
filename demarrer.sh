#!/usr/bin/env bash
#
# Demarre l'API Laravel et le site Next.js, et verifie d'abord ce qui
# manque le plus souvent. Les deux tournent en arriere-plan ; leurs
# journaux sont dans .logs/.
#
#   ./demarrer.sh          mode developpement
#   ./arreter.sh           pour tout arreter

set -u
cd "$(dirname "$0")"
RACINE="$PWD"
mkdir -p "$RACINE/.logs"

vert() { printf '\033[32m%s\033[0m\n' "$1"; }
rouge() { printf '\033[31m%s\033[0m\n' "$1"; }
info() { printf '  %s\n' "$1"; }

echo
echo "Vérifications"

# --- Base de donnees --------------------------------------------------
# XAMPP sert MariaDB par son propre socket ; le client du PATH cherche
# ailleurs et echoue meme quand la base tourne.
SOCKET=$(grep -E '^DB_SOCKET=' backend/.env 2>/dev/null | cut -d= -f2-)
MYSQL=/opt/lampp/bin/mysql
[ -x "$MYSQL" ] || MYSQL=mysql

if [ -n "${SOCKET:-}" ] && [ -S "$SOCKET" ]; then
  vert "  base de données joignable"
elif $MYSQL -u root -e "SELECT 1" >/dev/null 2>&1; then
  vert "  base de données joignable"
else
  rouge "  base de données injoignable"
  info "Démarrez MySQL. Sous XAMPP : sudo /opt/lampp/lampp startmysql"
  exit 1
fi

# --- Dependances ------------------------------------------------------
[ -d backend/vendor ] || { rouge "  dépendances PHP absentes"; info "cd backend && composer install"; exit 1; }
[ -d frontend/node_modules ] || { rouge "  dépendances JS absentes"; info "cd frontend && npm install"; exit 1; }
[ -f backend/.env ] || { rouge "  backend/.env absent"; info "cd backend && cp .env.example .env && php artisan key:generate"; exit 1; }
[ -f frontend/.env.local ] || { rouge "  frontend/.env.local absent"; info "cd frontend && cp .env.example .env.local"; exit 1; }
vert "  dépendances et configuration en place"

# --- Passerelle de paiement ------------------------------------------
DRIVER=$(grep -E '^PAYMENT_DRIVER=' backend/.env | cut -d= -f2-)
case "$DRIVER" in
  fake) info "paiement : simulation (aucun appel réseau, aucun débit)" ;;
  elgiopay) info "paiement : Elgiopay — $(grep -E '^ELGIOPAY_BASE_URL=' backend/.env | cut -d= -f2-)" ;;
  *) rouge "  PAYMENT_DRIVER inconnu : $DRIVER" ;;
esac

# --- Demarrage --------------------------------------------------------
arreter_si_occupe() {
  PID=$(ss -ltnp 2>/dev/null | grep ":$1 " | grep -oP 'pid=\K[0-9]+' | head -1)
  [ -n "$PID" ] && kill "$PID" 2>/dev/null && sleep 1
}

arreter_si_occupe 8000
arreter_si_occupe 3000

echo
echo "Démarrage"

# Le sous-shell est mis en arriere-plan en entier : $! designe alors bien
# le serveur, et le chemin du fichier de PID est resolu depuis la racine.
( cd "$RACINE/backend" && exec php artisan serve --host=127.0.0.1 --port=8000 ) \
  >"$RACINE/.logs/api.log" 2>&1 </dev/null &
echo $! >"$RACINE/.logs/api.pid"

( cd "$RACINE/frontend" && exec npm run dev ) \
  >"$RACINE/.logs/web.log" 2>&1 </dev/null &
echo $! >"$RACINE/.logs/web.pid"

for _ in $(seq 1 40); do
  curl -sf -o /dev/null http://127.0.0.1:8000/api/v1/settings && break
  sleep 1
done
for _ in $(seq 1 60); do
  curl -sf -o /dev/null http://127.0.0.1:3000/ && break
  sleep 1
done

echo
curl -sf -o /dev/null http://127.0.0.1:8000/api/v1/settings \
  && vert "  API    http://localhost:8000" \
  || rouge "  API n'a pas démarré — voir .logs/api.log"
curl -sf -o /dev/null http://127.0.0.1:3000/ \
  && vert "  Site   http://localhost:3000" \
  || rouge "  Site n'a pas démarré — voir .logs/web.log"

echo
info "Back-office : http://localhost:3000/connexion"
info "Journaux    : tail -f .logs/api.log  ou  .logs/web.log"
info "Arrêter     : ./arreter.sh"
echo
