<?php
/**
 * Configuration de la Base de Données.
 * 
 * Ce fichier est responsable de l'établissement de la connexion avec SQLite
 * via l'interface PDO (PHP Data Objects).
 * 
 * Il gère également l'initialisation automatique du schéma de base de données
 * (Auto-migration) pour garantir que l'application fonctionne dès le premier lancement.
 */

/**
 * Récupère une instance de connexion à la base de données.
 * 
 * @return PDO L'objet de connexion configuré et prêt à l'emploi.
 */
function getPDO() {
    // 1. Définition du chemin du fichier de base de données.
    // Nous utilisons __DIR__ pour obtenir un chemin absolu stable.
    // Le fichier 'database.sqlite' sera stocké à la racine du dossier 'src'.
    // Note : Dans un contexte réel, ce fichier devrait idéalement être hors du dossier public.
    $dbFile = __DIR__ . '/../database.sqlite';
    
    // 2. Création du DSN (Data Source Name).
    // C'est la chaîne de connexion qui indique à PDO quel pilote utiliser (sqlite).
    $dsn = "sqlite:$dbFile";

    try {
        // 3. Instanciation de PDO.
        // Si le fichier n'existe pas, SQLite tentera de le créer automatiquement ici.
        $pdo = new PDO($dsn);

        // 4. Configuration du mode d'erreur.
        // Par défaut, PDO peut être silencieux. Nous forçons le mode EXCEPTION
        // pour que les erreurs SQL (syntaxe, contraintes) lèvent des exceptions PHP
        // que nous pourrons attraper dans nos try/catch plus tard.
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        
        // 5. Initialisation de la structure (Migration).
        // Nous créons la table 'notes' uniquement si elle n'existe pas déjà.
        // Cela permet de déployer l'application sans exécuter de script SQL manuel.
        $pdo->exec("CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            content TEXT NOT NULL, 
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )");
        
        return $pdo;

    } catch (PDOException $e) {
        // En cas d'échec critique (ex: permission d'écriture refusée sur le disque),
        // on arrête tout et on affiche le message d'erreur technique.
        die("Erreur critique de connexion DB : " . $e->getMessage());
    }
}