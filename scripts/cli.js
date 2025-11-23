/**
 * INTERFACE DE LIGNE DE COMMANDE (CLI) PHP WASM
 * 
 * Ce script permet d'exécuter des scripts PHP (comme Composer, Artisan, ou des tests)
 * directement depuis le terminal Node.js, sans avoir PHP installé sur la machine hôte.
 * 
 * Utilisation : node scripts/cli.js [fichier.php] [arguments...]
 */

import { PHP } from '@php-wasm/universal';
// On importe les outils spécifiques à Node.js pour gérer le système de fichiers réel
import { createNodeFsMountHandler, loadNodeRuntime } from '@php-wasm/node';

(async () => {
    try {
        // ----------------------------------------------------------------
        // 1. INITIALISATION DU MOTEUR
        // ----------------------------------------------------------------
        // On charge le binaire PHP 8.3 (le fichier de ~600Mo téléchargé par setup-php.js).
        // C'est l'équivalent de lancer l'exécutable 'php' sur un serveur classique.
        const runtime = await loadNodeRuntime('8.3');
        const php = new PHP(runtime);

        // ----------------------------------------------------------------
        // 2. MONTAGE DU SYSTÈME DE FICHIERS (Le "Pont")
        // ----------------------------------------------------------------
        // Par défaut, PHP Wasm vit dans une bulle isolée en mémoire.
        // Pour qu'il puisse lire vos scripts et écrire des fichiers (ex: database.sqlite),
        // nous devons "monter" le dossier actuel (process.cwd()) dans le système virtuel de PHP.
        const cwd = process.cwd();
        
        // Création du point de montage (si nécessaire)
        await php.mkdir(cwd); 
        
        // Connexion du disque physique au disque virtuel
        await php.mount(cwd, createNodeFsMountHandler(cwd));
        
        // On place le curseur de PHP dans ce dossier
        await php.chdir(cwd);

        // ----------------------------------------------------------------
        // 3. PRÉPARATION DES ARGUMENTS
        // ----------------------------------------------------------------
        // Node.js reçoit : ["node", "cli.js", "mon-script.php", "--option"]
        // On enlève les 2 premiers pour ne garder que ce qui concerne PHP.
        const args = process.argv.slice(2);

        // ----------------------------------------------------------------
        // 4. EXÉCUTION EN MODE CLI
        // ----------------------------------------------------------------
        console.log(`🐘 Exécution Wasm : php ${args.join(' ')}`);
        
        // La méthode .cli() simule un environnement de terminal (SAPI CLI).
        // IMPORTANT : On ajoute 'php' en premier argument.
        // En C/C++ (et donc en PHP), le premier argument (argv[0]) est toujours le nom du programme.
        // Si on ne le met pas, PHP pensera que "mon-script.php" est le nom du programme
        // et cherchera le fichier à exécuter dans l'argument suivant (ce qui ferait tout décaler).
        const response = await php.cli(['php', ...args]);

        // ----------------------------------------------------------------
        // 5. GESTION DES FLUX (STREAMS)
        // ----------------------------------------------------------------
        // PHP Wasm utilise des "Web Streams" (standard du navigateur).
        // Node.js utilise des "Node Streams" (standard historique).
        // Nous devons faire le pont entre les deux pour afficher la sortie en temps réel.
        
        if (response.stderr) {
            const reader = response.stderr.getReader();
            readStream(reader, process.stderr); // Erreurs vers la console erreur
        }
        
        if (response.stdout) {
            const reader = response.stdout.getReader();
            readStream(reader, process.stdout); // Sortie normale vers la console
        }

        // ----------------------------------------------------------------
        // 6. GESTION DU CODE DE SORTIE (EXIT CODE)
        // ----------------------------------------------------------------
        // Si PHP termine avec une erreur (code != 0), on veut que Node.js
        // termine aussi avec une erreur (pour stopper les scripts CI/CD ou npm).
        response.exitCode.then((code) => {
            process.exit(code);
        });

    } catch (e) {
        console.error("❌ Erreur critique du Wrapper CLI :", e);
        process.exit(1);
    }
})();

/**
 * Fonction utilitaire pour lire un WebStream (Wasm) et l'écrire dans un NodeStream (Terminal).
 * Lit les données par morceaux (chunks) dès qu'elles arrivent.
 */
async function readStream(reader, output) {
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            // value est un Uint8Array (buffer d'octets)
            // output (process.stdout) sait comment écrire ces buffers directement
            if (value) output.write(value);
        }
    } catch (e) {
        console.error("Erreur de lecture du flux:", e);
    }
}