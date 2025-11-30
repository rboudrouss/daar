#!/bin/bash

set -e

ADMIN_PASSWORD="admin"

echo "En mode développement, le mot de passe de l'interface admin est: $ADMIN_PASSWORD"

# Si on est dans Backend/, on remonte d'un niveau
if [[ "$(basename "$PWD")" == "Backend" ]]; then
    cd ..
fi

# Vérifier si Backend/dist/index.js existe
if [[ -f "Backend/dist/index.js" ]]; then
    cd Backend
    ADMIN_PASSWORD=$ADMIN_PASSWORD node dist/index.js
else
    # Vérifier si pnpm est installé
    if command -v pnpm &> /dev/null; then
        echo "[SCRIPT] Pas de binaries dans Backend/dist/, je les build moi-même..."
        pnpm i
        pnpm build
        cd Backend
        echo "[SCRIPT] Lancement du serveur..."
        ADMIN_PASSWORD=$ADMIN_PASSWORD node dist/index.js
    else
        echo "Erreur: pnpm n'est pas installé et les binaries ne sont pas présents."
        echo ""
        echo "Options disponibles:"
        echo "  1. Installer pnpm (npm install -g pnpm)"
        echo "  2. Se débrouiller avec npm (pas testé): npm install && npm run build && cd Backend && node dist/index.js"
        echo "  3. Utiliser Docker: docker compose up (depuis la racine du projet)"
        exit 1
    fi
fi