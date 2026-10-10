#!/usr/bin/env bash
# Arrete les serveurs demarres par ./demarrer.sh
cd "$(dirname "$0")"

for nom in api web; do
  if [ -f ".logs/$nom.pid" ]; then
    PID=$(cat ".logs/$nom.pid")
    kill "$PID" 2>/dev/null && printf '  %s arrêté\n' "$nom"
    rm -f ".logs/$nom.pid"
  fi
done

# Filet : les serveurs de developpement relancent parfois un processus fils.
for port in 8000 3000; do
  PID=$(ss -ltnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' | head -1)
  [ -n "$PID" ] && kill "$PID" 2>/dev/null && printf '  port %s libéré\n' "$port"
done
