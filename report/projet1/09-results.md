# 4. Résultats et Analyse de Performance

## 4.1. Présentation des Résultats

Les résultats des tests sont issus de la commande `./egrep --test-all --test-folder data --csv report/projet1/performance.csv`. Le fichier `data` contient 9 fichiers de test, le même livre du projet Gutenberg, mais de taille croissante (de 1KB à 2MB). Nous testons les différents algorithmes sur plusieurs scénarios que vous pouvez retrouver dans le fichier `cli/src/test-all.ts`.

## 4.2. Boyer-Moore vs KMP

![KMP vs Boyer-Moore \label{kmp_boyer}](imgs/graph1_kmp_vs_boyermoore.png)

Les graphiques de la figure \ref{kmp_boyer} compare le temps de matching de KMP et Boyer-Moore pour des patterns littéraux de longueur variable. On observe bien que KMP est plus rapide que Boyer-Moore pour des patterns courts, mais que la situation inverse se produit pour des patterns longs. Cela justifie notre choix de KMP pour les patterns courts et Boyer-Moore pour les patterns longs.

## 4.3. Structure de l'automate: intérêt de la minimisation

![Taille de la structure \label{structure_size}](imgs/graph2_structure_size.png)

Les graphiques de la figure \ref{structure_size} compare la taille de la structure des automates NFA, DFA et min-DFA en moyenne sur les différents scénarios. On observe que le NFA est toujours plus grand que le DFA, qui lui est lui-même plus grand que le min-DFA. Cela confirme l'intérêt de la minimisation pour réduire la taille de la structure.

Cependant, la taille du DFA est souvent très proche de la taille du DFA minimisé, au vu de la complexité de l'algorithme de minimisation, il est possible de discuter de son interêt. Dans notre choix automatique, nous avons décidé de toujours opté pour un min-DFA car nous utilisons une structure DFA que si le text est assez grand pour ammortir le coût de construction.

![Cas pathologique du DFA \label{dfa_exponential}](imgs/graph7_worst_case_dfa.png)

Il est aussi nécessaire de mentionner que pour certain patternes, il peut arriver que le DFA soit une très mauvaise solution. Par exemple, pour des patterns contenant beaucoup d'alternations après une étoile, le nombre d'états du DFA peut exploser exponentiellement. Cela est le cas pour le scénario "Edge Case - DFA Exponential Blowup" affiché sur la figure \ref{dfa_exponential} qui contient 12 groupes alternatifs, nous nous retrouvons avec un DFA de 4097 états contre 76 pour le NFA.

## 4.4. Impact du préfiltrage

![Impact du préfiltrage \label{prefilter}](imgs/graph3_prefilter_impact.png)

La figure \ref{prefilter} compare le temps de matching avec et sans préfiltrage pour des textes de taille variable pour le NFA et le DFA. Pour les tailles de textes inférieurs à 10kb, nous observons que le préfiltrage est inutile voir même contre-productif. Car l'overhead que cela cause (construction d'Aho-Corasick quand il y a plusieurs littéraux, ou le fait d'analyser une ligne dans un premier temps avec le préfiltrage puis par la suite avec le matcher regex) n'est pas amorti par le gain de temps lors du matching.

On remarquera aussi que le préfiltrage est moins efficace pour le DFA que pour le NFA. Cela est dû au fait que le DFA est déjà un algorithme très rapide. 

## 4.5. Choix d'algorithme selon la taille du texte

![Choix d'algorithme selon la taille du texte \label{automata_comparison}](imgs/graph4_automata_comparison.png)

La figure \ref{automata_comparison} compare le temps de matching de différents algorithmes selon la taille du texte.

Nous remarquons que pour des textes de taille inférieure à 10kb, le NFA est le meilleur algorithme. Cela est cohérent avec notre analyse car le coût de construction du DFA n'est pas amorti pour de petits textes.

La droite du NFA est droite sur un plan log-log, la pente étant normal (proche de 1) alors nous pouvons dire que notre implémentation est linéaire comme prévu par la théorie.

Pour la droite du DFA, au delà de 10kb, nous observons que le temps de matching est linéaire comme prévu par la théorie. Cependant, pour des textes de taille inférieure à 10kb, le temps d'exécution semble constant. Celà est du au fait que le temps de construction du DFA n'est pas amorti pour de petits textes.

