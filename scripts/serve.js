/**
 * SERVEUR PHP INTERNE (PONT NODE.JS <-> PHP WASM)
 * 
 * Ce script crée un serveur HTTP Node.js (basé sur Express) qui agit comme une passerelle.
 * Il intercepte les requêtes HTTP et les transmet au moteur PHP compilé en WebAssembly.
 * 
 * Architecture :
 * Navigateur <--> Vite (Port 5173) <--> Ce Serveur (Port 3000) <--> Moteur PHP Wasm
 */

import express from 'express';
import { PHPRequestHandler, PHP } from '@php-wasm/universal';
// On charge la version "Node" du runtime car elle permet d'accéder au vrai système de fichiers
import { loadNodeRuntime, createNodeFsMountHandler } from '@php-wasm/node';
import path from 'path';

const app = express();

// Le port interne. Vite (sur le port 5173) fera "proxy" vers ce port.
const PORT = 3000; 

// Définition de la racine du site.
// process.cwd() est la racine du projet. On sert le dossier 'src'.
const DOC_ROOT = path.join(process.cwd(), 'src');

console.log(`📁 Racine interne configurée : ${DOC_ROOT}`);

(async () => {
    /**
     * 1. CONFIGURATION DU GESTIONNAIRE PHP
     * C'est le cerveau qui décide comment traiter une URL.
     */
    const handler = new PHPRequestHandler({
        documentRoot: DOC_ROOT,
        absoluteUrl: `http://localhost:${PORT}`,
        
        // --- ROUTAGE (FRONT CONTROLLER) ---
        // C'est l'équivalent de la règle "try_files" de Nginx ou du .htaccess d'Apache.
        // Si un fichier physique (image, css) n'existe pas, on redirige la requête vers index.php
        // Cela permet de créer des routes virtuelles comme /add ou /delete.
        getFileNotFoundAction: (path) => ({ type: 'internal-redirect', uri: '/index.php' }),
        
        // --- USINE À PHP (FACTORY) ---
        // Cette fonction est appelée chaque fois que le serveur a besoin d'une instance PHP.
        phpFactory: async () => {
            // Chargement du binaire "Lourd" (~600Mo) téléchargé par setup-php.js
            const runtime = await loadNodeRuntime('8.3');
            const php = new PHP(runtime);

            // A. LOGS : Redirection des sorties PHP vers le terminal Node.js
            // Sans ça, les "echo" et les erreurs PHP seraient invisibles.
            php.onStdout = (c) => process.stdout.write('PHP: ' + new TextDecoder().decode(c));
            php.onStderr = (c) => process.stderr.write('ERR: ' + new TextDecoder().decode(c));

            // B. PERSISTANCE (CRITIQUE POUR SQLITE)
            // Par défaut, PHP Wasm vit en mémoire RAM. Si on ne fait rien, la base de données
            // est perdue à chaque redémarrage ou nouvelle requête.
            // Ici, on "monte" le dossier physique 'src' dans le système de fichiers virtuel de PHP.
            await php.mount(DOC_ROOT, createNodeFsMountHandler(DOC_ROOT));
            
            // On place le curseur de PHP dans ce dossier.
            php.chdir(DOC_ROOT);

            return php;
        }
    });

    // On préchauffe une instance pour s'assurer que tout est chargé avant de recevoir du trafic
    await handler.getPrimaryPhp();
    console.log("🐘 Moteur PHP initialisé (Mode Persistant Activé)");

    /**
     * 2. MIDDLEWARE : GESTION DU BODY
     * PHP a besoin du flux de données brut (Raw Body) pour remplir $_POST.
     * Express parse souvent le body automatiquement, ce qui casse PHP.
     * Ici, on récupère les données binaires brutes manuellement.
     */
    app.use((req, res, next) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => { req.rawBody = Buffer.concat(chunks); next(); });
    });

    /**
     * 3. ROUTEUR PRINCIPAL (CATCH-ALL)
     * Intercepte TOUTES les requêtes entrantes (*)
     */
    app.all('*', async (req, res) => {
        try {
            // Transmission de la requête JS vers l'univers PHP Wasm
            const result = await handler.request({
                method: req.method,
                url: `http://localhost:${PORT}${req.url}`, // Reconstruction de l'URL complète
                headers: req.headers,
                body: req.rawBody
            });

            // --- GESTION DE LA RÉPONSE ---

            // A. Détection du type de contenu (HTML vs le reste)
            let isHtml = false;
            const responseHeaders = {};

            for (const [key, value] of Object.entries(result.headers)) {
                const lowerKey = key.toLowerCase();
                // Conversion des tableaux de headers PHP en chaînes pour Express
                const strValue = Array.isArray(value) ? value.join(', ') : value;
                
                if (lowerKey === 'content-type' && strValue.includes('text/html')) {
                    isHtml = true;
                }

                // On ignore content-length si c'est du HTML car on va modifier le contenu
                // (Injection du script Vite), ce qui changerait la taille.
                if (!isHtml || lowerKey !== 'content-length') {
                    responseHeaders[key] = value;
                }
            }

            // B. Envoi des statuts et headers au navigateur
            res.status(result.httpStatusCode);
            for (const [key, value] of Object.entries(responseHeaders)) {
                // Cas particulier : Set-Cookie doit rester un tableau pour Express
                if (key.toLowerCase() === 'set-cookie') {
                    res.set(key, value);
                } else {
                    res.set(key, Array.isArray(value) ? value.join(', ') : value);
                }
            }

            // C. INJECTION DU HOT RELOAD (HMR)
            if (isHtml) {
                // On décode les octets en texte
                let htmlContent = new TextDecoder().decode(result.bytes);
                
                // On injecte le script client de Vite.
                // Comme Vite agit comme proxy devant nous, il interceptera la requête vers /@vite/client
                // et servira le JS nécessaire pour le rechargement automatique.
                const viteScript = '\n<!-- Vite HMR Injection -->\n<script type="module" src="/@vite/client"></script>\n</body>';
                
                // Insertion propre avant la fin du body
                if (/<\/body>/i.test(htmlContent)) {
                    htmlContent = htmlContent.replace(/<\/body>/i, viteScript);
                } else {
                    htmlContent += viteScript;
                }

                res.send(htmlContent);
            } else {
                // Pour les images, JSON, etc., on envoie le binaire tel quel
                res.end(result.bytes);
            }

        } catch (e) {
            console.error("Erreur Serveur Interne:", e);
            res.status(500).send("Erreur interne du serveur PHP");
        }
    });

    // Démarrage de l'écoute réseau
    app.listen(PORT, () => console.log(`🐘 Serveur PHP interne écoute sur le port ${PORT}`));
})();