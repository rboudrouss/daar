## 2.3 Conversion NFA vers DFA 

### 2.3.1 Définition du DFA


Nous représentons un DFA par un objet TypeScript contenant :

```typescript
type DFA = {
  states: state_ID[];
  // On remarquera que contrairement au NFA, on a une seule cible par état et symbole
  transitions: { [state: state_ID]: { [symbol: string]: state_ID } };
  start: state_ID;
  accepts: state_ID[];
};
```

### 2.3.2 Principe de la Méthode des Sous-Ensembles

La construction par sous-ensembles (subset construction) transforme un NFA en un DFA équivalent. Le principe est que chaque état du DFA représente un ensemble d'états du NFA.

Pour chaque ensemble d'états NFA, on calcule les transitions pour chaque symbole de l'alphabet. Si un nouvel ensemble d'états est découvert, on crée un nouvel état DFA.

On notera que pour chaque NFA, il est toujours possible de construire un DFA équivalent, mais il peut y avoir une explosion combinatoire du nombre d'états (jusqu'à $2^n$).

La compléxité temporelle et spatiale est au pire des cas $O(2^n)$ avec $n$ le nombre d'états de l'NFA. En pratique, le nombre d'états générés est souvent beaucoup plus faible (souvent $O(n)$ ou $O(n^2)$).

On notera que la méthodes des sous-ensemble ressemble en partie à la simulation de l'NFA, mais au lieu de maintenir un ensemble d'états actifs, on explore de manière systématique tous les ensembles possibles. Il est donc peut-être possible de fusionner les deux algorithmes pour obtenir un algorithme plus efficace ? Nous en parlerons dans la prochaine section.

l'implémentation est dans le fichier `lib/src/DFA.ts` dans la fonction `dfaFromNfa`.


### 2.3.3 Gestion du Caractère Universel (DOT)

Notre implémentation traite spécialement le symbole `DOT` (caractère universel `.`), afin de garantir qu'il correspond à n'importe quel caractère, y compris le caractère spécifique recherché. 

Lors du calcul des transitions, si on cherche un symbole `s`, on considère aussi les transitions `DOT` du NFA car `DOT` peut matcher n'importe quel caractère, y compris le symbole spécifique.

### 2.3.4 Matching avec DFA

Le matching avec un DFA est beaucoup plus simple et rapide qu'avec un NFA, car il n'y a pas de non-déterminisme. Pour chaque caractère de l'entrée, on suit la transition correspondante. Si à la fin de l'entrée, on est dans un état acceptant, alors la chaîne est acceptée.

La complexité est $O(|w|)$ où w est la longueur de l'entrée. Chaque caractère nécessite une transition, et la recherche de la transition est en temps constant.

## 2.4 Minimisation du DFA

### 2.4.1 Motivation

Le DFA obtenu par la méthode des sous-ensembles peut contenir des états équivalents c'est à dire des états qui ont le même comportement pour toutes les entrées possibles. La minimisation consiste à fusionner ces états pour obtenir un DFA avec le nombre minimal d'états.

Pour notre implémentation, nous avons choisi de l'algorithme de partitionnement car il est simple à implémenter et suffisamment efficace pour nos besoins.

### 2.4.2 Principe de l'Algorithme de Partitionnement

L'algorithme de minimisation repose sur le raffinement itératif de partitions, en effet à chaque itération, on subdivise les partitions en sous-partitions si nécessaire. L'algorithme s'arrête lorsque toutes les partitions sont stables, c'est à dire que toutes les états de la partition ont la même signature (comportement identique pour toutes les entrées).

La complexité temporelle est en $O(n^2 \times |\Sigma|)$ où n est le nombre d'états et $\Sigma$ la taille de l'alphabet. En pratique, la complexité est souvent plus faible car l'algorithme s'arrête généralement avant d'avoir parcouru toutes les itérations.

Notez qu'il existe un algorithme plus efficace, celui de Hopcroft, mais nous n'avons pas eu le temps de l'implémenter.
