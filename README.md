# Développez en PHP dans votre navigateur  

Bienvenue dans un environnement de développement **PHP 8.3 + SQLite** complet, tournant **entièrement dans votre navigateur**, sans aucun serveur distant, sans Docker, et sans installation locale.

Ce projet est une démonstration technique de la puissance de **WebAssembly (Wasm)** couplé à l'IDE en ligne **StackBlitz Codeflow**. Il résout des défis d'infrastructure complexes pour offrir une expérience de développement fluide ("Developer Experience"), très utile pour l'enseignement de la programmation WEB.

---
## 🐘 Tester l'IDE 

[![Open in Codeflow](https://developer.stackblitz.com/img/open_in_codeflow.svg)](https://pr.new/davy39/php-stackblitz)

*Si vous rencontrez des problèmes, esayez avec google chrome.*

---

## 🎯 L'Objectif

Faire tourner un backend PHP traditionnel (avec accès disque, base de données, et routage) à l'intérieur d'un conteneur **Node.js** dans le navigateur.

Ce template permet de :
*   Coder en PHP directement dans l'IDE.
*   Avoir un **Serveur Web** qui répond aux requêtes HTTP.
*   Avoir une **Base de Données SQLite persistante**.
*   Profiter du **Hot Module Replacement (HMR)** : modifiez un fichier PHP, la page se recharge instantanément.
*   Utiliser une **Ligne de Commande (CLI)** pour exécuter des scripts PHP.

---

## 🚧 Le Défi Technique : Pourquoi c'est difficile ?

L'obstacle majeur pour faire tourner PHP dans StackBlitz réside dans la taille du binaire et les limitations réseau de l'environnement.

### Le problème du Proxy StackBlitz
Pour avoir un PHP complet (capable d'accéder au système de fichiers, d'utiliser SQLite, cURL, etc.), il faut utiliser le paquet **`@php-wasm/node`**.
Ce paquet contient un fichier WebAssembly (`php.wasm`) compilé statiquement qui pèse environ **600 Mo** (décompressé).

Sur StackBlitz, lancer un `npm install` standard échoue systématiquement avec ce paquet.
*   **La cause :** L'infrastructure de proxy et de cache NPM interne à StackBlitz (`t.staticblitz.com`) impose des limites de temps (timeout) et de taille de transfert. Le téléchargement d'un fichier aussi massif via ce proxy est interrompu (Socket hang up / CORS error) avant d'être complété, empêchant l'installation classique.

### 💡 La Solution : L'Installation "Furtive" (Sideloading)

Pour contourner le proxy de StackBlitz, ce projet n'inclut **pas** `@php-wasm/node` dans ses dépendances `package.json`. Au lieu de cela, nous avons développé une stratégie d'installation chirurgicale en 4 temps, orchestrée par le script `setup.js` :

1.  **Téléchargement Direct :** On contourne le proxy StackBlitz en interrogeant directement le registre NPM officiel (`registry.npmjs.org`). On utilise les Streams Node.js pour écrire l'archive `.tgz` sur le disque morceau par morceau, évitant ainsi de charger les 600Mo en mémoire RAM.
2.  **Inspection :** On extrait uniquement le fichier `package.json` de l'archive pour découvrir quelles dépendances (comme `ws` ou `express`) sont nécessaires au moteur PHP.
3.  **Injection des dépendances :** On demande à NPM d'installer ces sous-dépendances *avant* d'installer le moteur PHP. Cela évite que NPM ne supprime notre dossier "intrus" lors de son nettoyage (`prune`).
4.  **Extraction Finale :** Une fois NPM calmé, on extrait le binaire PHP final à sa place dans `node_modules`.

---


## 🏗️ Architecture du Projet

L'application repose sur une chaîne de trois serveurs qui collaborent :


Navigateur (Preview) 

   ⬇️ (Port 5173)

Serveur Vite (Proxy & HMR)

   ⬇️ (Port 3000)

Serveur Node.js (Express)

   ⬇️ (Interne)

Moteur PHP (WebAssembly)

   ⬇️ (Mount)

Système de Fichiers (/src)


### 1. Le Serveur Interne (`scripts/serve.js`)
C'est le pont entre le monde JavaScript et le monde PHP.
*   Il utilise **Express** pour recevoir les requêtes HTTP.
*   Il instancie la classe `PHP` via `@php-wasm/universal`.
*   Il **monte** le dossier `src/` du projet dans le système de fichiers virtuel de PHP. C'est ce qui permet à PHP de lire vos scripts et d'écrire dans `database.sqlite` de manière persistante.
*   Il injecte automatiquement le script client de Vite dans le HTML généré pour permettre le rechargement automatique.

### 2. Le Proxy de Développement (`vite.config.js`)
Vite est utilisé ici non pas comme bundler, mais comme **Reverse Proxy** intelligent.
*   Il sert l'application sur le port standard `5173`.
*   Il redirige les requêtes vers le serveur Node interne (`3000`).
*   Il surveille les fichiers `.php`. Dès qu'une modification est détectée, il envoie un signal **WebSocket** au navigateur pour forcer un rechargement complet de la page.

### 3. Le Wrapper CLI (`scripts/cli.js`)
Puisque nous ne pouvons pas installer PHP sur la machine hôte ("Linux"), nous utilisons ce script Node.js pour simuler la commande `php`.
*   Commande : `node scripts/cli.js mon-script.php`
*   Il charge le runtime Wasm, monte le disque, et exécute le script en mode **CLI** (Command Line Interface), en redirigeant les flux `STDOUT` et `STDERR` vers votre terminal.

---

## 📂 Structure des dossiers

```text
├── node_modules/      (Géré par notre script setup-php.js)
├── scripts/
│   ├── cli.js         # Le simulateur de commande "php"
│   ├── serve.js       # Le serveur Web Express -> PHP
│   └── setup.js   # Le script d'installation "furtif"
├── src/               # VOTRE CODE PHP (Monté à la racine virtuelle)
│   ├── config/        # Connexion Database
│   ├── models/        # Logique SQL
│   ├── views/         # Templates HTML
│   ├── index.php      # Point d'entrée (Front Controller)
│   └── database.sqlite # Base de données (générée automatiquement)
├── package.json       # Configuration minimale (juste 'tar' et 'vite')
└── vite.config.js     # Configuration du Proxy et du HMR
```

---

## 🚀 Utilisation

### Installation
Dès l'ouverture du projet dans StackBlitz Codeflow, le script `postinstall` se lance automatiquement. Si vous devez réinstaller manuellement :

```bash
npm install
# Le script setup.js se lancera automatiquement à la fin
```

### Lancement du Serveur
Pour démarrer l'environnement de développement :

```bash
npm run dev
```
*   Cela lance en parallèle le serveur PHP interne et Vite.
*   Ouvrez le panneau "Preview" pour voir le résultat.
*   Modifiez un fichier dans `src/` : la page se recharge seule.

### Ligne de commande PHP
Pour exécuter un script PHP arbitraire (maintenance, cron, test) :

```bash
# Exemple : Vérifier la version de PHP
node scripts/cli.js -v

# Exemple : Lancer un script de test
node scripts/cli.js src/mon_script.php
```

---

## 💡 Démonstration (MVC)

Le dossier `src/` contient une petite application de démonstration **"Gestionnaire de Notes"**.
Elle n'est là que pour prouver que l'environnement supporte :
1.  **Le Routage** : Toutes les URLs (`/add`, `/delete`) sont gérées par `index.php`.
2.  **La Base de Données** : Utilisation de `PDO` et `SQLite`.
3.  **L'Architecture** : Séparation Modèle / Vue / Contrôleur.

---

## ⚠️ Limitations connues

1.  **Réseau Sortant (cURL / Composer)** : Dans la version gratuite de StackBlitz, les connexions sortantes (socket raw) sont souvent bloquées ou instables. C'est pour cela que **Composer** ne peut pas télécharger de paquets facilement. La méthode recommandée pour ajouter des dépendances PHP est de glisser-déposer (Drag & Drop) un dossier `vendor` pré-installé depuis votre machine locale.
2.  **Performance** : PHP tourne en WebAssembly au-dessus de Node.js. C'est impressionnant, mais plus lent qu'un PHP natif. Pour du développement, c'est imperceptible, mais ce n'est pas fait pour de la production.

---

*Ce projet est une preuve de concept de l'ingénierie possible sur les environnements de développement modernes basés sur le navigateur.*