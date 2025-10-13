## 2.2 Construction du NFA (Automate Fini Non-Déterministe)

### 2.2.1 Définition

Nous représentons un NFA par un objet TypeScript contenant :

```typescript
type NFA = {
  states: state_ID[]; // ensemble fini d'états
  // Dictionnaire des transitions, la clé est l'état source, la valeur est un dictionnaire avec la clé
  // le symbole de transition et la valeur l'ensemble des états cibles
  transitions: { [state: state_ID]: { [symbol: string]: state_ID[] } };
  start: state_ID; // état initial
  accepts: state_ID[]; // ensemble d'états acceptants
};
```

Nous utilisons deux symboles spéciaux, `EPSILON` et `DOT`, pour représenter les $\epsilon$-transitions et le caractère universel, respectivement.

Le caractère non-déterministe signifie que depuis un état donné, plusieurs transitions peuvent être possibles pour un même symbole, et que des $\epsilon$-transitions (transitions sans consommer de caractère) sont autorisées.

### 2.2.2 Construction de Thompson (Algorithme d'Aho-Ullman)

La construction de Thompson est un algorithme récursif qui construit un NFA à partir d'un arbre syntaxique en appliquant des règles de composition pour chaque opérateur. Chaque sous-expression est transformée en un fragment de NFA avec un état initial et un état final unique.

La complexité est $O(n)$ où n est la taille de l'arbre syntaxique. Chaque nœud est visité exactement une fois, et chaque opération (création d'états, ajout de transitions) est en temps constant.

### 2.2.3 Fermeture $\epsilon$ (Epsilon Closure)

La fermeture $\epsilon$ d'un ensemble d'états S est l'ensemble de tous les états accessibles depuis S en suivant uniquement des $\epsilon$-transitions. Cette opération est fondamentale pour le matching avec NFA et la conversion NFA->DFA.

La complexité est $O(|Q| + |\delta|)$ où Q est l'ensemble des états et $\delta$ l'ensemble des transitions. Dans le pire cas, on visite tous les états et toutes les $\epsilon$-transitions.

### 2.2.4 Matching avec NFA

Pour vérifier si une chaîne w est acceptée par un NFA, on simule l'exécution de l'automate en maintenant l'ensemble des états actifs à chaque étape.

La complexité est $O(|w| \times |Q|^2)$ où w est la longueur de l'entrée et Q l'ensemble des états. Pour chaque caractère, on peut avoir jusqu'à $|Q|$ états actifs, et la fermeture $\epsilon$ peut visiter tous les états.
