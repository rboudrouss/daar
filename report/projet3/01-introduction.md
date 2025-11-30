# 1. Introduction

## 1.1. Contexte

Ce projet vise à développer une application web/mobile de moteur de recherche pour une bibliothèque numérique de documents textuels. Avec la numérisation massive des œuvres littéraires, notamment via des initiatives comme le projet Gutenberg, les bibliothèques numériques contiennent désormais des dizaines de milliers de documents. Une telle volumétrie rend la recherche manuelle impossible et nécessite des outils de recherche performants.

Ce problème a déjà été résolu notamment par des bases de données type elasticsearch. Dans ce projet, nous avons choisi de développer notre propre solution en utilisant le moins de dépendance possible pour explorer les algorithmes de recherche et de recommandation.

Dans ce projet, nous feront explicitement le choix de ne pas décrire les algorithmes déjà décrits dans le rapport du projet 1, en effet nous avons utilisé exactement les mêmes implémentations.

## 1.2. Composants technique

Notre projet peut être décomposé en 3 couches :

- **La base de données** qui est dans `Backend/data/`, elle contient les fichiers textuels (et les images de couverture), et une base de données SQLite qui contient les informations sur les documents (titre, auteur, etc.), le reverse index, le graphe de Jaccard, etc...

- **Le backend** qui est dans `Backend/`, il s'agit d'un serveur Node.js (avec Hono) qui expose une API REST.

- **Le frontend** qui est dans `Frontend/`, il s'agit d'une application React (avec TanStack Router).

## 1.4. Organisation du Rapport

TODO
