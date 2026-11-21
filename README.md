# Niki

Un cyberdeck pastel pour présenter vos projets open source : un terminal à explorer (`ls`, `cd`,
`cat`, `tree`, `chercher`), une cartouche par projet, des touches et des autocollants. Les dossiers
et fichiers de vos dépôts GitHub y sont vraiment consultables, et le site reste accessible au
clavier et au lecteur d'écran.

Exemple en ligne : [carolinedanslesnuages.github.io](https://carolinedanslesnuages.github.io/).

Le nom rend hommage à Niki de Saint Phalle, dont les *Nanas* colorées et joyeuses ont inspiré
l'esprit du cyberdeck.

## Créer le vôtre (5 minutes)

1. En haut de ce dépôt : **Use this template → Create a new repository**. Pour une adresse
   `https://<compte>.github.io/`, nommez-le `<compte>.github.io`.
2. Dans le nouveau dépôt : **Settings → Pages → Source : GitHub Actions**.
3. Modifiez [`site.config.json`](site.config.json) et ajoutez vos dépôts **publics** :

   ```json
   {
     "compte": "",
     "pseudo": "mon-pseudo",
     "accroche": "Mes projets open source, dans un terminal à explorer.",
     "mots": ["curieuse", "créative", "dynamique"],
     "presentation": ["Bonjour !", "", "Ce terminal montre mes projets."],
     "terminal": { "nom": "niki-os", "invite": "niki" },
     "palette": "bonbon",
     "projets": [
       { "depot": "mon-outil", "accroche": "Ce qu'il fait, en une ligne" },
       { "depot": "Essai", "nom": "Essai", "accroche": "Un projet pour apprendre", "etat": "essai" }
     ],
     "bientot": [{ "nom": "Prochain", "accroche": "En préparation" }]
   }
   ```

4. Poussez sur `main`. Le site se construit, se vérifie et se publie. Il se reconstruit aussi
   chaque nuit, pour reprendre les versions et les fichiers à jour de vos projets.

Sans aucun projet, le site fonctionne déjà : la baie de cartouches explique comment ajouter la
première.

| Clé | Rôle |
|---|---|
| `compte` | Votre compte GitHub. Vide : le propriétaire du dépôt. |
| `pseudo` | Le titre du site. Vide : le compte. |
| `accroche`, `mots`, `presentation` | La phrase d'en-tête, l'autocollant, et le texte de `moi`. |
| `terminal.nom`, `terminal.invite` | Le nom affiché sur l'écran, et l'invite (`niki:~$`). |
| `palette` | Couleur de départ de la coque : `bonbon`, `menthe` ou `peche`. |
| `projets` | Vos dépôts : `depot` (nom exact, majuscules comprises), `accroche`, `nom` et `etat: "essai"` facultatifs. |
| `bientot` | Des cartouches « bientôt », sans dépôt. |

## Ce qui est repris de vos dépôts

- Le nom, la description, la dernière version (release GitHub) et tous les fichiers.
- **Uniquement des dépôts publics** : un dépôt privé, absent ou renommé arrête la construction
  avec un message clair. Rien n'est publié par erreur.
- Pas de dossiers d'outillage cachés (`.claude`, `.agents`…), ni de dépendances ou de fichiers
  générés. Le texte des fichiers de plus de 40 Ko n'est pas affiché : un lien mène à GitHub.

## Accessibilité

Le terminal reste utilisable au clavier et au lecteur d'écran : l'écran se lit à son rythme, une
annonce courte résume chaque commande, la touche Tab ne piège jamais le focus, les dessins en
caractères sont masqués aux lecteurs d'écran, et tout ce qui s'affiche est cliquable.

À chaque construction, `npm run test:browser` vérifie dans Chromium des critères du RGAA 4.1.2
(lus avec [Marguerite](https://github.com/Carolinedanslesnuages/marguerite)) et axe-core
(WCAG 2.1 AA), sur ordinateur, téléphone, à 320 px et à 200 % : **si un critère casse, le site
n'est pas publié**.

## Développer

```sh
npm ci
GITHUB_TOKEN=$(gh auth token) npm run collect     # récupère vos projets
npm run dev                                        # http://localhost:5173
npm test                                           # moteur du terminal
npm run build && npx vite preview --port 4173 &    # puis :
npx playwright install chromium && npm run test:browser
```

Les PR sont contrôlées par [Constance](https://github.com/Carolinedanslesnuages/constance)
(`.github/workflows/constance.yml`) ; supprimez ce fichier si vous n'en voulez pas.

## Licence

[MIT](LICENSE).
