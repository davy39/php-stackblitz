<?php
/**
 * Contrôleur Frontal (Front Controller).
 * 
 * Ce fichier est le point d'entrée unique de l'application.
 * Toutes les requêtes (qu'elles soient pour /, /add, ou /delete) atterrissent ici.
 * 
 * Son rôle est d'analyser l'URL (Routage), d'appeler la bonne méthode du Modèle,
 * et d'inclure la Vue appropriée.
 */

// Démarrage de la session.
// Indispensable pour stocker des données qui persistent entre deux pages,
// comme les messages de confirmation ("Flash messages").
session_start();

// Chargement des dépendances.
// Dans un projet plus complexe, on utiliserait un "Autoloader" (via Composer).
// Ici, on inclut manuellement notre Modèle pour pouvoir parler à la base de données.
require_once __DIR__ . '/models/Note.php';


// -------------------------------------------------------------------
// 1. ROUTEUR (Analyse de la requête)
// -------------------------------------------------------------------

// On récupère le chemin de l'URL demandée (ex: "/add" ou "/").
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Nettoyage spécifique pour notre environnement Wasm/Serverless.
// Parfois, le serveur interne préfixe l'URL avec le nom du script.
// On le retire pour avoir des routes propres.
$path = str_replace('/index.php', '', $path);

// Si le chemin est vide, on considère que c'est la page d'accueil.
if ($path === '' || $path === false) {
    $path = '/';
}


// -------------------------------------------------------------------
// 2. CONTRÔLEURS (Logique métier pour chaque route)
// -------------------------------------------------------------------

/**
 * ROUTE : Ajouter une note
 * Méthode : POST
 * URL : /add
 */
if ($path === '/add' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    
    // Patch de compatibilité pour PHP Wasm :
    // Parfois, le Content-Type n'est pas correctement transmis depuis Node.js,
    // ce qui laisse $_POST vide. On lit alors le flux brut (php://input)
    // et on le parse manuellement.
    if (empty($_POST)) {
        parse_str(file_get_contents('php://input'), $_POST);
    }

    // Nettoyage des entrées utilisateur (Trim)
    $content = trim($_POST['content'] ?? '');
    
    if (!empty($content)) {
        // Appel au Modèle pour insérer en base
        Note::create($content);
        
        // Création d'un "Message Flash" en session.
        // Il sera affiché sur la page suivante, puis détruit.
        $_SESSION['flash'] = ['type' => 'success', 'msg' => '✨ Note ajoutée avec succès !'];
    } else {
        $_SESSION['flash'] = ['type' => 'error', 'msg' => '⚠️ Le contenu ne peut pas être vide.'];
    }
    
    // Pattern PRG (Post-Redirect-Get) :
    // Après une soumission de formulaire, on redirige toujours.
    // Cela évite que l'utilisateur renvoie le formulaire en rafraîchissant la page.
    header('Location: /');
    exit; // Toujours quitter après une redirection header()
}

/**
 * ROUTE : Supprimer une note
 * Méthode : GET (simulé)
 * URL : /delete/{id}
 * 
 * On utilise une Expression Régulière (Regex) pour capturer l'ID dynamique.
 * (\d+) signifie "un ou plusieurs chiffres".
 */
if (preg_match('#^/delete/(\d+)$#', $path, $matches)) {
    // $matches[1] contient l'ID capturé par la parenthèse (\d+)
    $idToDelete = $matches[1];
    
    Note::delete($idToDelete);
    
    $_SESSION['flash'] = ['type' => 'success', 'msg' => '🗑️ Note supprimée.'];
    
    header('Location: /');
    exit;
}

/**
 * ROUTE : Accueil
 * Méthode : GET
 * URL : /
 */
if ($path === '/') {
    // 1. Récupération des données via le Modèle
    $notes = Note::getAll();
    
    // 2. Gestion du message Flash
    // On le récupère dans une variable locale pour la Vue...
    $flash = $_SESSION['flash'] ?? null;
    // ... et on le supprime de la session pour qu'il ne s'affiche qu'une seule fois.
    unset($_SESSION['flash']);
    
    // 3. Rendu de la Vue
    // En incluant le fichier ici, la vue aura accès aux variables
    // définies juste au-dessus ($notes et $flash).
    require __DIR__ . '/views/home.php';
    exit;
}


// -------------------------------------------------------------------
// 3. GESTION DES ERREURS (404)
// -------------------------------------------------------------------

// Si aucune route n'a été trouvée ci-dessus, on arrive ici.
http_response_code(404);
echo "404 Not Found - La page demandée n'existe pas.";