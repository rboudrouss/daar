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

Le parsing de l'expression régulière en arbre syntaxique est réalisé par un parseur récursif descendant. Cette technique consiste à définir une fonction de parsing pour chaque niveau de la grammaire, en respectant la hiérarchie de précédence. Chaque fonction lit l'entrée jusqu'à rencontrer un opérateur de niveau inférieur, puis appelle la fonction de parsing correspondant au niveau inférieur.

Le parsing s'effectue en $O(n)$ où n est la longueur de l'expression régulière, avec un seul passage sur l'entrée.
