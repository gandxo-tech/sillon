# Sillon — Fiche de soumission au NASA Space Apps Challenge 2026

Défi : **Field Shift: Adapting Farms with NASA Data**.

Version anglaise : [SOUMISSION.md](./SOUMISSION.md).

## 1. Résumé (120 mots)

Sillon est une aide à la décision au navigateur pour les petits exploitants du
Sahel. Il prend la localisation, le sol et le climat d'une parcelle, les
cultures de l'exploitant et ses priorités, et renvoie une rotation classée avec
une explication en langage simple, un tableau comparatif en FCFA par hectare, et
la liste des rotations écartées avec leur motif. Chaque chiffre vient d'un
calcul ou d'une source étiquetée ; rien n'est inventé. Les observations de NASA
POWER, d'ERA5 et de MODIS alimentent le bilan hydrique et l'estimation de
l'érosion ; SoilGrids et SRTM alimentent le sol. Le moteur est déterministe,
testé par 24 cas, et dit lui-même ses limites. Il ne prescrit pas : il propose,
montre son travail, et laisse la décision finale à l'exploitant et à son
agronome.

## 2. Problème

Au Sahel, la pluie est devenue plus irrégulière et plus courte, les sols
s'amincissent sur les pentes, et les intrants coûtent plus cher que les grains.
Un exploitant qui change de rotation à l'instinct risque de perdre une saison ;
un qui le fait sur un conseil générique risque l'inadéquation avec son eau, son
budget ou son matériel. L'information dont il a besoin existe (climat
satellitaire, cartes de sol mondiales), mais elle n'est pas dans sa langue, pas
à son échelle, et pas classée selon ses priorités.

## 3. Utilisateur nommé

Awa, 38 ans, cultive 2,5 ha près de Ouahigouya (Burkina Faso), sur une pente
douce à sol lourd. Elle cultive mil, sorgho et niébé, n'a pas de cheptel, et
dispose d'un petit budget d'intrants. Son mil a perdu environ un tiers de son
rendement dans les années sèches de 2022 et 2023. Elle n'a pas d'agronome à
portée de main et pas d'argent à perdre sur une saison. Sillon est fait pour
elle : il classe les rotations sur son eau, son budget et son travail, en
français, et dit ce qu'il n'a pas pu voir.

Les cinq scénarios de référence de `src/moteur/__tests__/scenarios.ts` sont
bâtis sur son type de parcelle. Ce n'est pas une mesure unique.

## 4. Exigence du défi → fichier

| Exigence du défi | Où elle est satisfaite |
|---|---|
| Observations de la Terre | `src/analyse/features.ts` (NASA POWER quotidien, ERA5, MODIS via GIBS) |
| Données de sol | `src/analyse/features.ts` (SoilGrids v2, SRTM/USGS 3DEP) |
| Caractéristiques des cultures | `src/data/cultures.ts` (24 cultures, cycles, besoins en eau, prix) |
| Priorités de l'exploitant | `src/App.tsx:46` (6 curseurs), `src/moteur/moteur.ts:76` (`calculerPoids`) |
| Recommandation d'adaptation | `src/rapport/rapport.ts:120` (`construireRapport`) |
| Limites énoncées | bloc 6 du rapport, `README.md` §10 |

## 5. Données NASA utilisées (points d'accès)

- `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,T2M,T2M_MAX,T2M_MIN,GWETTOP` — NASA POWER, 2001–présent (mise à jour quotidienne).
- `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/...` — MODIS Terra, actuel.
- `https://climate-api.open-meteo.com/v1/climate` — ERA5 historique et projection CMIP6 (un seul modèle).
- `https://rest.isric.org/soilgrids/v2.0/properties/query` et `/classification/query` — SoilGrids v2.
- `https://api.open-meteo.com/v1/elevation` et `https://epqs.nationalmap.gov/v1/json` — SRTM / USGS 3DEP.

Toutes les requêtes partent du navigateur ; aucun serveur Sillon n'est au
milieu. Chaque source rend son propre état dans le rapport (bloc 8).

## 6. Méthodologie et formules

- Bilan hydrique par succession : pluie de saison contre ET0 × Kc par culture × part de saison, avec 15 jours de tolérance. Les successions dont le manque d'eau dépasse 55 % sont écartées (`EAU`).
- Érosion : RUSLE à partir de la pluie annuelle, de la texture (K tabulé), de la pente (SRTM) et de la couverture.
- Score : somme pondérée de six critères (eau, revenu, sol, sécurité, intrants, travail), poids issus des curseurs de l'exploitant, normalisés à 1 :
  `poids.eau = 1 + 2·sobriétéEau`, `poids.revenu = 1 + 3·revenu`,
  `poids.sécurité = 1 + 3·sécuritéAlimentaire`, `poids.intrants = 1 + 2·autonomieIntrants`,
  `poids.sol = 1 + 1·préservationSol`, `poids.travail = 1 + 1·(100 − mainOeuvre)`.
- Budget : coût des intrants par an contre le budget déclaré (`CAPITAL`).
- Délai de retour : une culture doit attendre `retour` ans avant de revenir (`RETOUR`).
- pH du sol : chaque culture a une plage de pH (`PH`).
- Marché : les cultures fourragères demandent un cheptel (`MARCHE`).
- Tenue du cycle : chaque culture doit tenir dans la saison (`CYCLE`).
- Stabilité : le classement est rejoué à −10 % et −20 % de pluie ; si l'écart entre le rang 1 et le rang 3 est inférieur à 4 points, `stabilité : "fragile"`.
- Déterminisme : graine = FNV-1a 32 bits sur `lat|lon|ids` ; mulberry32 pour les variantes. Aucun `Math.random()`.

## 7. Ce que l'outil ne peut pas voir

Énoncé dans le rapport lui-même (bloc 6) et dans le `README.md` §10 :

- Le sol est une prédiction à 250 m, pas une mesure de son champ. Une analyse de terre peut contredire tout le rapport.
- Un seul modèle CMIP6, pas une distribution de probabilité.
- Le tassement est invisible : rien dans les données ne voit une semelle de labour.
- Les ravageurs et maladies sont invisibles ; les délais de retour sont des règles de bon sens.
- Pas de prix de campagne : les marges viennent d'une table fixe.
- Le K de RUSLE est tabulé, pas ajusté au sol local.
- Sept API publiques, CORS côté navigateur : chacune peut tomber ou changer un champ.
- La clé Google Maps est côté client (restreinte par référent et quota).
- Le fournisseur annonce ERA5 à ≈ 9 km ; la grille native est à 0,25° (≈ 25–30 km), ce que l'étiquette dans l'app affiche désormais.
- Coûts d'intrants, pas bénéfices : pas de crédit, pas de valorisation du travail familial, pas de foncier.
- Aucune validation au champ : la sortie n'a pas été comparée à des rendements mesurés.

## 8. Résultats sur les scénarios témoins

`npm run tableau` sur les cinq scénarios de référence :

| Scénario | Succession en tête | Score |
|---|---|---|
| Parcelle sèche, priorité revenu | Mil puis Sorgho | 49,1 |
| Sans cheptel déclaré | Niébé puis Maïs puis Niébé | 61,4 |
| Historique contenant du maïs | Brachiaria puis Soja puis Brachiaria | 59,9 |
| Priorité argent (cas 4, jeu A) | Niébé puis Sorgho puis Niébé | 56,7 |
| Parcelle humide, cheptel, budget moyen | Maïs puis Arachide puis Maïs | 55,4 |

Aucune succession ne gagne plus d'un scénario sur cinq : le moteur n'a pas de
favori, il répond à la parcelle. Marge d'erreur : les scores sont ordinaux et
dépendent d'une table de prix fixe et de prédictions de sol mondiales ; ce
ne sont pas des prévisions de rendement.

## 9. Feuille de route vers un déploiement avec une coopérative

1. Calibrer la table de prix avec les acheteurs de la coopérative.
2. Remplacer la prédiction de sol à 250 m par une analyse de terre par parcelle de membre.
3. Ajouter une prévision saisonnière (pas seulement la climatologie) dès qu'une source fiable est choisie.
4. Validation au champ : comparer les recommandations aux rendements mesurés sur 10 parcelles pendant une saison.
5. Mode hors ligne et interface vocale en mooré et en dioula.
6. Base commune et anonymisée des parcelles pour améliorer les coefficients.

## 10. Équipe et crédits

Soil AI Crew — NASA Space Apps Challenge 2026. Code sous licence MIT
(`LICENSE`). Données tierces sous leurs propres conditions (voir `LICENSE`).
Aucune nouvelle dépendance npm n'a été ajoutée ; l'application tourne sur
React et Vite seulement.

## Liens

- En ligne : https://soil-ai-app.vercel.app
- Dépôt : https://github.com/gandxo-tech/sillon
- Audit : `AUDIT.md`
- Script oral : `ORAL.md`
