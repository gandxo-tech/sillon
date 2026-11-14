# Sillon

Aide à la décision pour les rotations de cultures, à partir d'un seul point géographique.

Vous donnez un lieu (ou des coordonnées, ou votre position) et deux cultures : celle en place,
celle que vous envisagez ensuite — en choisissant dans la liste illustrée ou en tapant leur nom
librement (« tournesol », « colza », « prairie »…). Une culture inconnue de la base reçoit des
coefficients génériques, signalés dans le rapport. Sillon interroge des sources publiques en direct, en déduit
les caractéristiques agronomiques du lieu, compare **votre** rotation à trois alternatives et
produit un rapport expliqué.

**Aucune donnée de démonstration** : chaque chiffre affiché vient d'une API publique, et les
sources qui échouent sont listées en fin de rapport plutôt que remplacées en silence.

## Lancer

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # vérification TypeScript + build de production
```

Site statique (Vite + React + TypeScript + Google Maps). Aucun backend. Aucune clé n'est
nécessaire : sans clé, la carte Google s'affiche en vue satellite intégrée. Avec
`VITE_GOOGLE_MAPS_API_KEY` (facultatif), le point se déplace en cliquant sur la carte.
tous les appels sont faits depuis le navigateur.

## Sources interrogées

| Source | Variable | Résolution |
| --- | --- | --- |
| NASA POWER | pluie et températures quotidiennes sur 10 ans, humidité de surface | 0,5° |
| ERA5 (Copernicus) | ET0 Penman-Monteith FAO-56, gel, jours > 30 °C | ~9 km |
| ERA5-Land | humidité du sol 0–7 cm | ~9 km |
| SoilGrids (ISRIC) | texture, carbone, pH, réserve utile | 250 m |
| PixelGust | repli SoilGrids quand le pixel exact n'a pas de prédiction | 250 m |
| USGS 3DEP / SRTM | altitude et pente (5 points à 1 km) | 1 m / 30 m |
| Open-Meteo | prévision 14 jours, projection CMIP6 | 1–25 km |
| Google Maps | fond satellite et interaction de la carte | 1 m |
| Open-Meteo / OpenStreetMap | géocodage | — |

## Ce que l'outil calcule

- **Climat** : zone, indice d'aridité (pluie annuelle / demande évaporative), variabilité
  interannuelle, tendance de la pluie.
- **Saison** : plus longue fenêtre sans gelée (gelées détectées sur les minima quotidiens),
  dates médianes.
- **Eau** : déficit de saison, réserve utile du sol, demande par culture (`ET0 × kc × part de
  saison`), avec la part de réserve mobilisable selon la profondeur d'enracinement.
- **Sol** : texture USDA, matière organique (`SOC × 1,724`), pH, réserve utile, érodibilité K.
- **Érosion** : RUSLE simplifiée — R dérivé de la pluie annuelle (Renard & Freimund), K de la
  texture, LS de la pente mesurée, C du couvert du cycle.
- **Rotations** : votre rotation déclarée en référence, puis trois alternatives, sous trois
  conditions (climat observé, −20 % de pluie, +2 °C) plus la projection CMIP6 propre au point.
- **Lecture sans lire** : chaque culture a un pictogramme et une couleur, le verdict est un
  panneau visuel (icône, cycle en images, jauge de dix blocs) et le résumé se lit à voix haute
  via la synthèse vocale du navigateur (`Écouter le résumé`).
- **Délai de retour** : une culture qui revient sous 60 % de son délai conseillé est signalée
  (maïs sur maïs), une alternance courte reste praticable.

## Limites connues

- SoilGrids est un modèle, pas une mesure, et ISRIC déconseille son usage à l'échelle de la
  parcelle. Quand le pixel exact n'a pas de prédiction, la valeur vient du pixel voisin et le
  rapport l'indique, avec la distance.
- Les marges brutes sont des ordres de grandeur européens : elles comparent des stratégies
  entre elles, elles ne promettent pas un revenu.
- Une projection CMIP6 est une direction, pas une prévision ; l'ET0 y est dérivée du delta de
  température (+4,5 %/°C) faute d'ET0 dans ce jeu de données.
- Le modèle hydrique ne simule pas l'irrigation ni les reliquats azotés.

Sillon est un support d'aide à la décision. Il ne remplace ni l'observation de terrain, ni le
savoir-faire de l'exploitant, ni l'expertise d'un agronome.

## Crédits

NASA POWER · NASA GIBS · Copernicus/ECMWF (ERA5) · ISRIC SoilGrids (CC BY 4.0) via PixelGust ·
USGS 3DEP · Open-Meteo · OpenStreetMap (ODbL) · Google Maps.

## Équipe

Projet réalisé par **Soil AI Crew** pour le NASA Space Apps Challenge 2026.

Développé par DAOUDA Abdou Chahid, Exaucé GBAGUIDI et Pancrace KANHONOU.

Emblème de l'équipe : bleu pur, jaune citron et blanc.
