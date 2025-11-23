<?php
/**
 * Modèle : Note
 * 
 * Dans l'architecture MVC, le Modèle est responsable de la "Logique Métier" et de la donnée.
 * Ce fichier encapsule toutes les interactions SQL.
 * 
 * Le reste de l'application (Contrôleur) ne doit jamais écrire de SQL.
 * Il doit simplement demander au Modèle : "Donne-moi les notes" ou "Crée une note".
 */

// Import de la fonction de connexion (définie dans config/database.php)
require_once __DIR__ . '/../config/database.php';

class Note {
    
    /**
     * Récupère toutes les notes, triées de la plus récente à la plus ancienne.
     * 
     * @return array Tableau associatif contenant toutes les lignes de la table 'notes'.
     */
    public static function getAll() {
        // 1. Obtention de la connexion (Singleton-like via getPDO)
        $pdo = getPDO();
        
        // 2. Exécution de la requête.
        // Ici, nous utilisons query() directement car la requête SQL est fixe
        // et ne contient aucune variable utilisateur. Il n'y a pas de risque d'injection.
        return $pdo->query("SELECT * FROM notes ORDER BY created_at DESC")->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Crée une nouvelle note dans la base de données.
     * 
     * @param string $content Le texte de la note.
     * @return bool True si l'insertion a réussi, False sinon.
     */
    public static function create($content) {
        $pdo = getPDO();
        
        // SÉCURITÉ CRITIQUE : Requêtes Préparées (Prepared Statements)
        // ------------------------------------------------------------
        // Nous n'injectons JAMAIS la variable $content directement dans la chaîne SQL.
        // Mauvais : "INSERT ... VALUES ('$content')" <- Faille d'injection SQL !
        // Bon     : "INSERT ... VALUES (:content)"    <- Le moteur SQL gère la sécurité.
        $stmt = $pdo->prepare("INSERT INTO notes (content) VALUES (:content)");
        
        // L'exécution sépare l'instruction SQL des données brutes.
        return $stmt->execute([':content' => $content]);
    }

    /**
     * Supprime une note par son identifiant unique.
     * 
     * @param int $id L'ID de la note à supprimer.
     * @return bool True si la suppression a réussi.
     */
    public static function delete($id) {
        $pdo = getPDO();
        
        // Même principe de sécurité ici.
        // On prépare la structure de la requête avec un "placeholder" (:id).
        $stmt = $pdo->prepare("DELETE FROM notes WHERE id = :id");
        
        // On lie la valeur réelle au moment de l'exécution.
        return $stmt->execute([':id' => $id]);
    }
}