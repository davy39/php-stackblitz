import { defineConfig } from 'vite';

/**
 * Configuration de Vite.
 * 
 * Dans cette architecture "PHP Wasm", Vite ne sert pas à compiler du JS/CSS (bien qu'il le pourrait),
 * mais il agit principalement comme un "Médiateur" (Middleware) entre le Navigateur et le serveur PHP.
 * 
 * Rôles de Vite ici :
 * 1. Servir l'application sur le port 5173 (port exposé par StackBlitz).
 * 2. Proxy (relai) : Transférer les requêtes HTTP vers notre serveur PHP interne (port 3000).
 * 3. HMR (Hot Module Replacement) : Surveiller les fichiers PHP et recharger la page automatiquement.
 */
export default defineConfig({
  server: {
    // Le port standard de Vite. C'est celui que StackBlitz ouvrira dans la prévisualisation.
    port: 5173,
    
    // Empêche Vite de chercher un autre port si le 5173 est occupé.
    // C'est important pour que la configuration StackBlitz reste stable.
    strictPort: true,
    
    // Configuration du HMR (Hot Module Replacement) pour les environnements Cloud.
    hmr: {
        // CRUCIAL POUR STACKBLITZ :
        // StackBlitz expose l'application via HTTPS (port 443) derrière un load balancer.
        // Si on ne force pas le clientPort à 443, le navigateur essaiera de se connecter
        // au WebSocket sur le port 5173, ce qui sera bloqué par le pare-feu.
        clientPort: 443 
    },
    
    // Configuration du Proxy Inverse
    // C'est ici qu'on connecte Vite (Front) à PHP (Back).
    proxy: {
      // La règle '/' capture TOUTES les requêtes.
      '/': {
        // Destination : notre serveur Node.js/PHP Wasm qui tourne en arrière-plan.
        target: 'http://localhost:3000',
        changeOrigin: true,
        
        // Fonction de filtrage (Bypass) :
        // On ne veut PAS envoyer les requêtes internes de Vite vers PHP.
        // PHP ne saurait pas quoi faire de "/@vite/client" ou "/node_modules/...".
        bypass: (req) => {
            if (
                req.url.startsWith('/@vite') || // Scripts internes de Vite
                req.url.startsWith('/@id') ||   // Identifiants de modules
                req.url.includes('node_modules') // Dépendances JS
            ) {
                // En retournant req.url, on dit au proxy : "Ne touche pas à ça, laisse Vite le servir".
                return req.url;
            }
            // Si on ne retourne rien, la requête continue vers 'target' (PHP).
        }
      }
    }
  },

  // Plugins personnalisés
  plugins: [
    {
      name: 'php-watch-reload',
      
      // Hook (crochet) appelé à chaque fois qu'un fichier est modifié.
      handleHotUpdate({ file, server }) {
        // Si le fichier modifié est un fichier PHP...
        if (file.endsWith('.php')) {
          console.log(`🔥 PHP modifié : ${file} -> Reload`);
          
          // ... on envoie un signal via WebSocket au navigateur pour forcer un rafraîchissement total.
          // (PHP ne supportant pas le remplacement modulaire à chaud comme le JS/CSS).
          server.ws.send({ type: 'full-reload' });
        }
      }
    }
  ]
});