# Phase 0 — Inventaire et diagnostic (Sillon, NASA Space Apps 2026)

## Tableau des fichiers

| Chemin | Lignes | Rôle | Problèmes détectés |
|---|---|---|---|
| `src/moteur/moteur.ts` | 806 | Moteur de décision : pool, filtres durs, classement, stabilité | Aucun (refondu) |
| `src/analyse/features.ts` | 573 | Extraction du profil parcelle (NASA POWER, ERA5, SoilGrids, SRTM, Open-Meteo) | Étiquette ERA5 ≈ 9 km surestime la résolution native (≈ 25–30 km) |
| `src/analyse/rotations.ts` | 364 | Métriques par succession (eau, RUSLE, revenu, azote) | Code scientifique, jamais exposé hors bloc 8 |
| `src/rapport/rapport.ts` | 471 | Rapport en 8 blocs | — |
| `src/rapport/explication.ts` | 456 | Explication en 3 temps, 6 archétypes, 6 variantes | — |
| `src/rapport/leviers.ts` | 69 | Actions concrètes par code de rejet | Ajouté en V2 |
| `src/rapport/technique.ts` | 51 | Bloc 8 replié (seul lieu où le jargon est autorisé) | — |
| `src/rapport/variantes.ts` | 173 | Phrasings déterministes par emplacement | — |
| `src/App.tsx` | 724 | Interface, saisie, tableau comparatif, conseil IA | — |
| `src/data/cultures.ts` | 213 | 24 cultures avec métriques | — |
| `api/ia.js` | 221 | Conseil IA via Groq (POST uniquement) | Durci (rate limit, timeout, no-store, anti-injection) |
| `src/components/*` | 44–185 | Cartes, graphiques, carte, tableau | Non testés (rendu) |
| `README.md` / `README.fr.md` | 435 / 446 | Documentation bilingue, 16 sections | — |
| `LICENSE` | 45 | MIT + mention données tierces | Ajouté en V2 |
| `.env.example` | 10 | Gabarit de configuration | Ajouté en V2 |
| `.github/workflows/ci.yml` | 14 | CI (tests + build) | Ajouté en V2 |

## Les dix questions, avec preuve

1. **Les rotations comparées sont-elles encore codées en dur ?** Non. `src/moteur/moteur.ts:250` (`construireEspace`) génère toutes les paires et triplets ordonnés à partir des cultures saisies ; aucun catalogue.
2. **Existe-t-il une entrée « priorités de l'exploitant » ?** Oui. `src/App.tsx:46` (tableau `CURSEURS`, six curseurs 0–100) et `src/moteur/moteur.ts:76` (`calculerPoids`).
3. **La rotation « actuelle » est-elle dérivée des cultures saisies ?** Oui. `src/moteur/moteur.ts:624` (`candidatReference`), construite depuis `e.actuelle`.
4. **Les contraintes dures sont-elles des filtres ou des pénalités ?** Des filtres. `src/moteur/moteur.ts:472` (`verifier`) renvoie un `Rejet` avec un code (`CYCLE`, `PH`, `EROSION`, `RETOUR`, `MARCHE`, `EAU` seuil 55 %, `CAPITAL`).
5. **Les candidats rejetés sont-ils affichés, avec leur motif ?** Oui. `src/rapport/rapport.ts` bloc « Ce que le moteur a écarté » (`rejets` + `puces` des leviers), visible sans clic.
6. **Une trace de raisonnement est-elle visible par l'utilisateur ?** Oui. Bloc 8 replié (comptage, pondérations, bilan hydrique, RUSLE, codes de rejet, trace d'explication) et `gagneSur`/`perdSur` par option.
7. **Y a-t-il un test de stabilité du classement ?** Oui. `src/moteur/moteur.ts:798` (`stabilite: 'fragile' | 'solide'`) sous pluie −10 % et −20 %, avec phrase dédiée.
8. **Combien de mots du lexique interdit apparaissent dans les sections visibles ?** Zéro. `grep` sur `src/rapport` (hors `technique.ts` replié) et `src/App.tsx` ne renvoie aucun mot interdit dans un texte affiché ; les occurrences sont des identifiants de code (`et0Annuel`, `kc`) ou le bloc technique autorisé.
9. **Où sont les clés et secrets ? Sont-ils restreints par referer ?** Google Maps : `VITE_GOOGLE_MAPS_API_KEY` (client, à restreindre par référent HTTP + quota, documenté). Groq : `GROK_KEY` côté serveur (`api/ia.js`), jamais envoyée au navigateur.
10. **Le dépôt a-t-il README bilingue, licence, `.env.example`, CI ?** README bilingue 16 sections : oui. Licence MIT : oui (ajoutée). `.env.example` : oui (ajouté). CI : oui (ajoutée, `.github/workflows/ci.yml`).

## Correctifs ordonnés (coût / critère d'acceptation)

| # | Correctif | Coût | Critère d'acceptation |
|---|---|---|---|
| 1 | Ajouter `LICENSE` MIT + mention données tierces | 0,5 h | Fichier présent à la racine |
| 2 | Ajouter `.env.example` | 0,25 h | Gabarit présent, `.env` ignoré par git |
| 3 | Ajouter CI GitHub Actions (tests + build) | 0,5 h | Workflow déclenché sur push et PR |
| 4 | Durcir `/api/ia` (rate limit, timeout, no-store, anti-injection, cache modèle) | 2 h | HTTP 429 au-delà de 6 appels / 5 min, pas de fuite de clé |
| 5 | Leviers d'action par code de rejet | 2 h | Un rejet affiche un geste concret ; test vert |
| 6 | Verdict tranché en fin de conseil IA | 0,5 h | La réponse se termine par « Finalement… » |
| 7 | Logo officiel (remplacer la reconstitution) | 0,25 h | Fichier déposé dans `public/` |
| 8 | Rédiger `SOUMISSION.md` / `SOUMISSION.fr.md` | 4 h | 10 sections imposées, 120 mots de résumé |
| 9 | Rédiger le script oral + Q&A | 2 h | 4 min, 5 réponses préparées |
| 10 | Valider la phase 4 (grep lexique interdit) | 0,5 h | `grep` vide hors bloc technique |

Tests obligatoires (déjà verts) : 6 cas moteur + 11 explication + 5 leviers = 22 cas, plus le cas par archétype et le cas neutre dans la suite explication.
