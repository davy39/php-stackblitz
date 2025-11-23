import fs from 'fs';
import { Readable } from 'stream';
import { x } from 'tar';
import { execSync } from 'child_process';
import path from 'path';

// -------------------------------------------------------------------
// CONFIGURATION
// -------------------------------------------------------------------

const TARGET_DIR = './node_modules/@php-wasm/node';

// URL de l'API NPM pour récupérer les métadonnées du paquet.
// Le suffixe "/latest" nous renvoie directement le JSON de la dernière version stable.
const REGISTRY_URL = 'https://registry.npmjs.org/@php-wasm/node/latest';

// Dossiers temporaires
const TEMP_TGZ = './temp/php.tgz';
const TEMP_META_DIR = './temp'; 

/**
 * Installe la dernière version de @php-wasm/node en contournant les limites de StackBlitz.
 */
async function installPhpNode() {
  console.log('🐘 Démarrage de l\'installation dynamique...');

  // --- ÉTAPE 0 : RÉCUPÉRATION DE L'URL DYNAMIQUE ---
  console.log(`🔍 Recherche de la dernière version sur NPM...`);
  
  const metaResponse = await fetch(REGISTRY_URL);
  if (!metaResponse.ok) throw new Error(`Impossible de joindre le registre NPM: ${metaResponse.statusText}`);
  
  const metadata = await metaResponse.json();
  const tarballUrl = metadata.dist.tarball;
  const version = metadata.version;
  
  console.log(`✅ Dernière version trouvée : ${version}`);
  console.log(`🔗 URL de l'archive : ${tarballUrl}`);

  // --- ÉTAPE 1 : TÉLÉCHARGEMENT ---
  if (!fs.existsSync(TEMP_META_DIR)) fs.mkdirSync(TEMP_META_DIR, { recursive: true });
  
  console.log(`⬇️  Téléchargement de l'archive...`);
  
  const response = await fetch(tarballUrl);
  if (!response.ok) throw new Error(`Erreur HTTP lors du téléchargement: ${response.statusText}`);
  
  const fileStream = fs.createWriteStream(TEMP_TGZ);
  await new Promise((resolve, reject) => {
    Readable.fromWeb(response.body).pipe(fileStream);
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
  });

  // --- ÉTAPE 2 : ANALYSE CHIRURGICALE (package.json) ---
  console.log('📖 Lecture des dépendances requises...');
  
  await x({ 
    file: TEMP_TGZ, 
    cwd: TEMP_META_DIR, 
    strip: 1,
    filter: (path) => path.includes('package.json')
  });

  const pkg = JSON.parse(fs.readFileSync(path.join(TEMP_META_DIR, 'package.json'), 'utf-8'));
  
  const deps = Object.entries(pkg.dependencies || {})
    .map(([n, v]) => `${n}@${v}`).join(' ');

  // --- ÉTAPE 3 : INSTALLATION DES DÉPENDANCES ---
  if (deps) {
    console.log('🔧 Installation des dépendances via NPM...');
    try {
      execSync(`npm install ${deps} --no-save --no-package-lock`, { stdio: 'inherit' });
    } catch (e) {
      console.warn('⚠️ Note: Erreurs mineures NPM ignorées.');
    }
  }

  // --- ÉTAPE 4 : EXTRACTION FINALE ---
  console.log('📦 Installation du moteur PHP Node (Extraction)...');
  
  if (!fs.existsSync(TARGET_DIR)) fs.mkdirSync(TARGET_DIR, { recursive: true });
  
  await x({ 
    file: TEMP_TGZ, 
    cwd: TARGET_DIR, 
    strip: 1 
  });

  // --- ÉTAPE 5 : NETTOYAGE ---
  console.log('🧹 Nettoyage...');
  try {
    fs.unlinkSync(TEMP_TGZ);
    fs.rmSync(TEMP_META_DIR, { recursive: true, force: true });
  } catch (e) {}
  
  console.log(`🚀 Installation de PHP v${version} terminée avec succès !`);
}

installPhpNode().catch(err => {
  console.error('❌ Erreur critique :', err);
  process.exit(1);
});