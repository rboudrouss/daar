# 2. Fondements Théoriques

### 2.1.3 Arbre Syntaxique Abstrait (AST)

Pour faciliter la manipulation et la transformation des expressions régulières, nous les représentons sous forme d'arbre syntaxique abstrait (Abstract Syntax Tree, AST).

Nous définissons un type `SyntaxTree` en TypeScript :

```typescript
export type SyntaxTree =
  | { type: "char"; value: string }      // Caractère littéral
  | { type: "dot" }                       // Caractère universel '.'
  | { type: "concat"; left: SyntaxTree; right: SyntaxTree }  // Concaténation
  | { type: "alt"; left: SyntaxTree; right: SyntaxTree }     // Alternation
  | { type: "star"; child: SyntaxTree };                     // Étoile de Kleene
```
**Exemple** : L'expression régulière `(a|b)*c` est représentée par l'arbre :

```
        concat
       /      \
     star      char('c')
      |
     alt
    /   \
char('a') char('b')
```

### 2.1.4 Algorithme de Parsing

Le parsing de l'expression régulière en arbre syntaxique est réalisé par un parseur récursif descendant. Cette technique consiste à définir une fonction de parsing pour chaque niveau de la grammaire, en respectant la hiérarchie de précédence.

**Structure du parseur** :

1. **`parseAlternation()`** : Point d'entrée, gère l'opérateur `|` (priorité minimale)
   - Parse le membre gauche avec `parseConcatenation()`
   - Tant qu'on rencontre `|`, parse le membre droit et construit un nœud `alt`

2. **`parseConcatenation()`** : Gère la concaténation implicite
   - Accumule une séquence de facteurs avec `parseFactor()`
   - Réduit la séquence en un arbre binaire gauche avec des nœuds `concat`

3. **`parseFactor()`** : Gère l'opérateur `*`
   - Parse la base avec `parseBase()`
   - Tant qu'on rencontre `*`, enveloppe dans un nœud `star`

4. **`parseBase()`** : Gère les éléments atomiques
   - Parenthèses : appel récursif à `parseAlternation()`
   - Point : retourne un nœud `dot`
   - Échappement : consomme le backslash et retourne le caractère suivant comme littéral
   - Caractère simple : retourne un nœud `char`

**Complexité** : Le parsing s'effectue en $O(n)$ où n est la longueur de l'expression régulière, avec un seul passage sur l'entrée.
