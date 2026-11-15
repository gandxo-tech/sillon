# FAQ — Sillon

## Sillon remplace-t-il un agronome ?
Non. Sillon donne un point de départ chiffré et la trace de son raisonnement.
La décision finale reste à l’exploitant et à son agronome.

## D’où viennent les prix en FCFA ?
D’une table fixe (marges brutes par culture). Ce n’est pas le marché de la
semaine ; calibrer cette table avec les acheteurs de la coopérative est la
première étape d’un déploiement.

## Que se passe-t-il si une source de données tombe ?
L’application se dégrade et signale l’échec. Chaque source rend son propre état
dans le rapport (bloc 8). Le moteur tourne sur les données disponibles.

## Le sol est vu tous les 250 m : est-ce assez précis ?
Non au niveau du champ. SoilGrids est une prédiction globale. Le rapport le
dit et recommande une analyse de terre.

## Le système propose-t-il des cultures qui ne poussent pas ici ?
Non pour les suggestions automatiques : la recherche élargie n’ajoute que des cultures
compatibles avec la zone climatique de votre parcelle (déduite de la latitude). Le blé,
par exemple, n’est proposé qu’en zone tempérée. Si vous saisissez vous-même une culture,
elle est respectée, mais le rapport signale qu’elle est estimée.

## La langue s’adapte-t-elle à l’utilisateur ?
Oui : les sept premiers blocs évitent le jargon, les termes techniques sont
réservés au bloc 8 replié. Le conseil IA répond en français simple. Une
version vocale en mooré et en dioula est prévue.

## Comment sont protégées mes données ?
Aucun compte, aucune donnée personnelle envoyée à un serveur Sillon. Les
calculs tournent dans le navigateur ; seules les requêtes vers les sources
publiques quittent la machine.

## Le modèle IA invente-t-il des chiffres ?
Non : la consigne interdit d’inventer un chiffre et demande de le dire si une
donnée manque. Le conseil se termine par un verdict tranché (« Finalement… »).

## Le code est-il libre ?
Oui, licence MIT (`LICENSE`). Les données tierces restent sous leurs propres
conditions.
