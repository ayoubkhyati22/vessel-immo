#!/bin/bash

# Script de déploiement automatique pour Vercel
echo "🚢 Déploiement Vessel Tracker API sur Vercel..."

# Vérifier si Vercel CLI est installé
if ! command -v vercel &> /dev/null; then
    echo "📦 Installation de Vercel CLI..."
    npm install -g vercel
fi

# Vérifier si c'est un projet git
if [ ! -d ".git" ]; then
    echo "📁 Initialisation du repository git..."
    git init
    git add .
    git commit -m "Initial commit - Vessel Tracker API"
fi

# Installer les dépendances
echo "📦 Installation des dépendances..."
npm install

# Créer .gitignore si inexistant
if [ ! -f ".gitignore" ]; then
    echo "📝 Création du .gitignore..."
    cat > .gitignore << EOL
node_modules/
.vercel
.env
.env.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
EOL
fi

# Test local rapide
echo "🧪 Test local rapide..."
echo "Démarrage du serveur de développement..."
timeout 10s vercel dev &
PID=$!
sleep 5

# Test de l'endpoint (avec IMO générique)
if curl -s "http://localhost:3005/" > /dev/null; then
    echo "✅ Test local réussi"
else
    echo "⚠️  Test local échoué (normal si pas de connexion)"
fi

# Arrêter le serveur de test
kill $PID 2>/dev/null

# Déploiement sur Vercel
echo "🚀 Déploiement sur Vercel..."
vercel --prod

echo ""
echo "🎉 Déploiement terminé !"
echo ""
echo "📋 Prochaines étapes :"
echo "  1. Notez l'URL de déploiement fournie par Vercel"
echo "  2. Testez votre API avec un IMO valide :"
echo "     curl 'https://YOUR-DOMAIN.vercel.app/api/vessel?imo=XXXXXXX'"
echo "  3. Configurez n8n avec la nouvelle URL"
echo ""
echo "📖 Documentation : https://YOUR-DOMAIN.vercel.app/"
echo "🔍 Test endpoint : https://YOUR-DOMAIN.vercel.app/api/vessel?imo=XXXXXXX"
echo ""
echo "💡 Remplacez XXXXXXX par un numéro IMO valide à 7 chiffres"