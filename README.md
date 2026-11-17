# Vérif Taverny 4.2 — édition terrain

Application web statique responsive pour le CIS Taverny. Déployable sur un hébergement statique HTTPS, sans compilation ni serveur applicatif supplémentaire.

## Démarrage et mise à jour

1. Sauvegarder la version actuelle du projet.
2. Décompresser cette archive à la racine du site, en remplaçant les anciens fichiers.
3. Ouvrir `index.html` depuis l'hébergement HTTPS, ou tester localement depuis le dossier avec `python -m http.server 8080`, puis ouvrir `http://localhost:8080`.
4. Vérifier sur un poste de test le chargement des fiches, l'enregistrement, les photos, l'historique et les droits d'accès avant le déploiement opérationnel.
5. Si une ancienne version de la PWA persiste, fermer puis rouvrir ses fenêtres et actualiser la page. Le nouveau service worker remplace les anciens caches de Vérif Taverny.

Sur Android/Chrome, l'installation est proposée si le navigateur la permet. Sur iOS, utiliser Safari > Partager > Sur l'écran d'accueil.

## Ce qui change

### Version 4.2

- Validation obligatoire du nom et prénom (au minimum un nom valide) avant d'accéder aux engins, aux postes et aux fiches, même par une ancienne URL. Le nom est proposé à nouveau à la session suivante ou après une heure d'inactivité constatée à l'ouverture d'une page.
- Brouillons isolés par nom de vérificateur ; reprise des anciens brouillons seulement si leur nom correspond.
- Dans Administration > Photos, choisir **Présentation** (photo de la caserne, logo ou un des cinq engins) ou **Photos des fiches** (engin, poste, compartiment, emplacement photo). Aperçu de la photo actuelle et de la nouvelle image avant remplacement. Aucun chemin de fichier à saisir.
- Les visuels sont enregistrés dans le bucket existant `Photo_Engins` aux mêmes emplacements que les fiches. L'accueil et les fiches utilisent les photos en ligne en priorité ; sinon la photo d'archive disponible est utilisée.
- Les photos de repérage restent visibles directement sous le titre du compartiment, avec agrandissement au toucher ; les archives sont identifiées.
- Les manquants sont mis en évidence en rouge : ligne, compartiment, compteur permanent, boutons d'accès rapide et engin. Les manquants du dernier contrôle restent signalés tant qu'ils n'ont pas été contrôlés.
- Écran de lancement web avec la photo de la caserne, logo, titre et indicateur de chargement ; images de démarrage iOS pour douze tailles d'iPhone et icône Android adaptative. L'écran de démarrage natif Android dépend du navigateur et ne peut pas être entièrement personnalisé par une PWA. Les visuels iOS natifs sont des ressources embarquées ; la gestion des photos modifie les images de l'application en ligne, pas les ressources natives déjà installées.

Le changement de photo nécessite que les règles du stockage existant autorisent l'ajout ou le remplacement. L'utilisateur administrateur doit tester les droits réels. Aucun fichier distant n'a été modifié pendant le développement.

### Version 4.1

- Accueil avec la véritable photo du CIS et le logo historique retrouvés dans le ZIP fourni, compressés pour un affichage rapide.
- Grille d'engins avec de grandes photos et indication des postes contrôlés sur la garde. Les images en ligne du projet restent prioritaires ; les vues locales de secours sont identifiées comme archives.
- Reprise du dernier brouillon directement depuis l'accueil et le choix de l'engin.
- Progression compacte toujours visible, choix direct du compartiment, bouton « Suivant » qui rejoint le premier matériel restant, boutons Présent/Absent agrandis et barre d'enregistrement fixe.
- Photos de repérage accessibles dans des galeries dépliables et agrandissables. Les photos historiques du projet servent uniquement de recours visuel, identifiées « Archive » si l'image actuelle est indisponible.
- Appareil photo et galerie séparés sur smartphone, compression sans bloquer la saisie et compteur de photos.
- Historique avec choix rapides de la période, miniatures et agrandissement des photos de vérification.

Les images d'archive sont des documents historiques issus de l'ancien projet ; elles ne certifient pas le rangement ou le matériel actuel. Se référer à la fiche en vigueur et contrôler le matériel réel.

### Fonctionnalités conservées de la version 4.0

- Accueil centré sur la garde en cours et cinq engins.
- Une seule interface et un moteur commun pour les 18 postes ; les anciennes URL sont conservées sous forme de redirections.
- Contrôle explicite de chaque matériel : présent, absent ou encore à contrôler. Recherche et filtres, progression, brouillon local pendant une heure depuis la dernière modification.
- Signalement des manquants du dernier contrôle, commentaire obligatoire en présence de manquants et validation ARI à partir de 280 bar lorsque le champ est prévu dans la fiche.
- Photos des conducteurs : sélection/capture via le téléphone, aperçu, suppression avant l'envoi, compression JPEG et limite de six photos.
- Confirmation seulement après réponse positive de l'enregistrement ; en cas d'échec, la fiche reste ouverte et le brouillon n'est pas supprimé.
- Historique par période (7 jours par défaut, 92 jours maximum), filtres par engin, résultat et texte. La nuit commence à 20 h et inclut les contrôles jusqu'à 8 h le lendemain. Détails, commentaires, valeurs et photos chargées à la demande.
- Les accès Bureau OPS et Administration restent disponibles. Les destinations vers BMM, SAP, Stationnaire, Chef de centre et Consignes SOG ont été retirées de l'accueil car leurs pages étaient absentes du ZIP.
- Suppression de l'historique Git de l'archive livrée, du fond photographique global et du code dupliqué des fiches.

## Compatibilité des données

Les configurations Firebase et Supabase d'origine ont été conservées. Aucune migration ni modification de données distantes n'a été effectuée.

| Élément | Format conservé |
|---|---|
| Structure des fiches | Firestore `FICHEVerif/{id}`, sections avec `order` et `items` |
| Vérifications | Firestore `verifications/{nomDoc}_{timestampMs}` |
| Champs | `nomDoc`, `date`, `verificateur`, `commentaire`, `data` |
| Matériel | Identifiant historique normalisé `section_libellé` ; booléen présent/absent |
| ARI | Valeur numérique dans `data` lorsque le champ est prévu |
| Références | Supabase `Photo_Engins/{id}/{section}.jpg` (+ suffixes CVTU historiques) |
| Photos | Supabase `photo_verif/CO-{engin}/{id vérification}/photo_*.jpg` |
| Comptes | Firestore `users/{identifiant}`, rôles existants |

## Points de vigilance

- Les brouillons sont locaux au navigateur et ne sont pas des vérifications enregistrées. Les photos sélectionnées ne sont pas conservées après fermeture de la page.
- La PWA met en cache son interface et les structures déjà consultées. La transmission et l'accès à l'historique nécessitent le réseau ; aucune fausse confirmation hors ligne n'est affichée.
- Après un échec pendant une transmission avec photos, il est préférable de réessayer depuis la même fiche. Des photos déjà envoyées mais non associées à un contrôle peuvent subsister si la page est fermée.
- Les anciennes règles d'accès aux comptes authentifient côté navigateur à partir des données Firestore. La restriction de navigation ajoutée n'est pas une protection serveur. Avant un usage sensible, prévoir une migration vers Firebase Authentication, des règles Firestore par rôle et des politiques Supabase appropriées. Il n'est pas nécessaire de modifier les comptes actuels pour tester cette version.
- Les services distants n'ont pas été sollicités durant la réalisation. Les contrôles réels de droits, d'index Firestore, de stockage des photos et de connectivité doivent être effectués sur un environnement de recette autorisé.

## Organisation

- `index.html`, `app.js`, `app.css` : interface opérationnelle.
- `model.js` : engins, postes, compatibilité des identifiants et calcul des gardes.
- `backend.js` : accès aux services, chargé à la demande.
- `admin.html`, `bureau-ops.html`, `style.css` : espaces de gestion existants.
- `mobile.css` : composants et adaptation mobile de la version 4.1.
- `assets/`, `assets-index.js` : images optimisées et index de localisation des photos historiques.
- `manifest.json`, `service-worker.js`, icônes : installation et cache PWA.
- Anciennes pages HTML : redirections de compatibilité, sans code métier dupliqué.
