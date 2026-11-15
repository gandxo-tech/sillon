# Script oral — Sillon (4 minutes)

Une ligne par respiration. Montrer l'écran en parallèle, sans clic
supplémentaire pour la trace.

## 0:00 – 0:40 — La personne et son problème (zéro technologie)

- Awa a trente-huit ans.
- Elle cultive deux hectares et demi près de Ouahigouya.
- Pente douce, sol lourd.
- Mil, sorgho, niébé. Pas d'animaux.
- En 2022 et 2023, son mil a perdu un tiers.
- Elle n'a pas d'agronome à portée de main.
- Elle n'a pas d'argent à perdre sur une saison.

## 0:40 – 1:10 — Ce qui existe aujourd'hui et ne lui convient pas

- Les conseils génériques ne connaissent pas son eau.
- Les applications supposent une connexion, un smartphone récent, et de l'anglais.
- Les données satellitaires existent, mais elles ne sont pas à son échelle.
- Et elles ne sont pas classées selon ce qui compte pour elle.

## 1:10 – 2:40 — Le parcours, options écartées montrées à l'écran

- Elle tape son village. La carte se centre.
- Le sol et le climat se chargent seuls.
- Elle saisit mil, sorgho, niébé.
- Elle règle six curseurs : argent, nourriture, eau, engrais, terre, main-d'œuvre.
- Le moteur construit toutes les paires et les triplets de ses cultures.
- Il en écarte plusieurs, avec le motif en français.
- Ici, la luzerne est écartée : pas de cheptel.
- Ici, une succession est écartée : pas assez d'eau.
- Il reste trois options, classées.
- Chacune montre ce qu'elle gagne et ce qu'elle perd, en FCFA par hectare.
- La meilleure obtient soixante et un points sur cent.
- Si la pluie baisse de vingt pour cent, une autre option tient mieux.
- Le verdict se termine par une phrase tranchée.

## 2:40 – 3:20 — Les sources NASA, puis les limites, dites par nous

- La pluie vient de NASA POWER, vingt-quatre ans.
- La température et l'évaporation aussi.
- L'image du sol vient de MODIS, aujourd'hui.
- La projection climatique vient d'ERA5 et d'un modèle CMIP6.
- Le sol vient de SoilGrids, à deux cent cinquante mètres.
- La pente vient de SRTM.
- Et maintenant les limites.
- Le sol est une prédiction, pas une mesure.
- Un seul modèle climatique, pas une probabilité.
- Le tassement est invisible.
- Les ravageurs sont invisibles.
- Pas de prix de campagne.
- Aucune validation au champ.

## 3:20 – 4:00 — Ce qu'il faudrait pour déployer avec une coopérative

- Calibrer les prix avec les acheteurs de la coopérative.
- Une analyse de terre par parcelle de membre.
- Une prévision saisonnière au lieu de la seule climatologie.
- Une validation sur dix parcelles pendant une saison.
- Un mode hors ligne et une voix en mooré et en dioula.
- Sillon ne remplace pas l'agronome. Il lui donne un point de départ.

---

## Réponses préparées

**« Comment validez-vous sans mesure de terrain ? »**
On ne valide pas encore, et on le dit. Les scores sont ordinaux, pas des
prévisions de rendement. La validation au champ est l'étape suivante : dix
parcelles, une saison, comparaison des recommandations aux rendements mesurés.
En attendant, chaque chiffre est étiqueté : calcul de l'engine ou statut d'une
source.

**« Pourquoi pas un conseiller humain ? »**
Parce qu'il n'y en a pas à portée de main pour Awa, et qu'un conseiller humain
ne peut pas lire vingt-quatre ans de pluie sur sa parcelle en une visite. Sillon
n'est pas un remplaçant : c'est un point de départ que l'agronome peut
contester, avec la trace à l'écran.

**« D'où viennent vos prix ? »**
D'une table fixe dans `src/data/cultures.ts`, marges brutes par culture. Ce n'est
pas le marché de la semaine, et on le dit. Calibrer cette table avec les
acheteurs de la coopérative est la première étape du déploiement.

**« Que se passe-t-il si une API tombe ? »**
L'application se dégrade et signale l'échec. Chaque source rend son propre état
dans le rapport. Le moteur tourne toujours sur les données qu'il a, et le verdict
porte la mention « données partielles » quand une source a échoué.

**« Quelle précision à 250 m ? »**
Aucune au niveau du champ. SoilGrids est une prédiction globale. C'est pour cela
que le rapport dit « le sol est vu tous les 250 m, votre parcelle est plus
mélangée que ça ; seule une analyse de terre tranche ». On n'a pas caché cette
limite, on l'a mise dans le rapport.
