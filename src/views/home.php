<?php
/**
 * Vue Principale : Liste des Notes.
 * 
 * Ce fichier est un "Gabarit" (Template). Son unique responsabilité est l'affichage.
 * Il ne contient aucune logique métier, aucune requête SQL.
 * 
 * Variables attendues (injectées par le contrôleur index.php) :
 * @var array $notes  Liste des notes récupérées depuis la base de données.
 * @var array|null $flash  Message de notification optionnel (clé 'type' et 'msg').
 */
?>
<!DOCTYPE html>
<html lang="fr" class="h-full bg-gray-50">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>PHP Wasm Notes</title>
    
    <!-- 
      Utilisation de Tailwind CSS via CDN pour le prototypage rapide.
      Dans un projet de production, on préférerait une compilation locale.
    -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- Importation d'une police Google Fonts pour un rendu plus soigné -->
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap');
        body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body class="h-full text-gray-800 antialiased">
    <div class="max-w-3xl mx-auto px-4 py-10">
        
        <!-- En-tête de la page -->
        <div class="text-center mb-10">
            <h1 class="text-4xl font-bold text-indigo-600 mb-2">🐘 Mes Notes (MVC)</h1>
            <p class="text-gray-500">Architecture séparée : Modèle / Vue / Contrôleur</p>
        </div>

        <!-- 
          AFFICHAGE DES MESSAGES FLASH
          On vérifie si la variable $flash existe avant de l'afficher.
          Le style change dynamiquement selon le type ('success' ou 'error').
        -->
        <?php if (isset($flash)): ?>
            <div class="mb-6 p-4 rounded-lg border <?php echo $flash['type'] === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'; ?>">
                <!-- htmlspecialchars est vital ici pour éviter les failles XSS si le message contient du HTML -->
                <?php echo htmlspecialchars($flash['msg']); ?>
            </div>
        <?php endif; ?>

        <!-- 
          FORMULAIRE D'AJOUT
          L'action pointe vers la route virtuelle '/add' définie dans le routeur.
        -->
        <div class="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
            <form action="/add" method="POST" class="flex gap-3">
                <input type="text" name="content" 
                       class="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                       placeholder="Nouvelle note..." 
                       required autocomplete="off" autofocus>
                <button type="submit" class="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition">
                    Ajouter
                </button>
            </form>
        </div>

        <!-- LISTE DES NOTES -->
        <div class="space-y-4">
            <?php if (empty($notes)): ?>
                <!-- État vide : UX importante pour guider l'utilisateur -->
                <p class="text-center text-gray-400 italic">Aucune note pour le moment.</p>
            <?php else: ?>
                <!-- Boucle d'affichage des données -->
                <?php foreach ($notes as $note): ?>
                    <div class="bg-white rounded-lg p-5 shadow-sm border border-gray-200 flex justify-between items-start hover:shadow-md transition">
                        <div>
                            <!-- 
                              SÉCURITÉ XSS :
                              On utilise htmlspecialchars() sur le contenu utilisateur ($note['content']).
                              Si un utilisateur écrit "<script>alert('Hack')</script>", cela sera affiché comme texte et non exécuté.
                            -->
                            <p class="text-lg"><?php echo htmlspecialchars($note['content']); ?></p>
                            
                            <!-- Formatage de la date pour un rendu plus lisible -->
                            <span class="text-xs text-gray-400">
                                <?php echo date('d/m/Y à H:i', strtotime($note['created_at'])); ?>
                            </span>
                        </div>
                        
                        <!-- 
                          Lien de suppression
                          On passe l'ID dans l'URL. L'attribut onclick ajoute une sécurité côté client.
                        -->
                        <a href="/delete/<?php echo $note['id']; ?>" 
                           onclick="return confirm('Voulez-vous vraiment supprimer cette note ?')" 
                           class="text-gray-400 hover:text-red-600 p-2"
                           title="Supprimer">
                           ✕
                        </a>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
        
    </div>
</body>
</html>