# 6. Recherche Avancée par Regex

## 6.1. Problématique

En utilisant les Regex, on ameliore grandement la granularité des recherches.Cependant, appliquer un automate (NFA ou DFA) à chaque terme de l'index est coûteux. Si un vocabulaire atteint 500 000 termes (proche de notre base de donnée), une approche naïve serait impraticable.

## 6.2. Architecture de la Solution

Notre approche combine deux niveaux de filtrage :

1. **Pré-filtrage SQL** : réduire le nombre de candidats en exploitant la structure du pattern
2. **Validation NFA** : appliquer l'automate uniquement aux termes candidats

```{.mermaid}
graph LR
    A[Pattern Regex] --> B[Parser]
    B --> C[Arbre Syntaxique]
    C --> D[PatternAnalyzer]
    C --> E[Construction NFA]
    D --> F[SqlQueryBuilder]
    F --> G[Requête SQL]
    G --> H[(SQLite)]
    H --> I[Termes Candidats]
    I --> J{NFA nécessaire?}
    J -->|Oui| K[NfaMatcher]
    J -->|Non| L[Résultats]
    K --> L
    E --> K
```

## 6.3. Analyse du Pattern

Le module `PatternAnalyzer` examine l'arbre syntaxique pour déterminer le type de pattern :

| Type | Exemple | Optimisation SQL |
|------|---------|------------------|
| `exact` | `cat` | `term = 'cat'` |
| `alternation` | `cat\|dog` | `term IN ('cat', 'dog')` |
| `prefix` | `cat.*` | `term LIKE 'cat%'` |
| `suffix` | `.*ing` | `term LIKE '%ing'` |
| `contains` | `.*cat.*` | `term LIKE '%cat%'` |
| `sql_pattern` | `c.t` | `term LIKE 'c_t'` |
| `match_all` | `.*` | `1=1` (tous) |
| `complex` | `(ab)*c*` | |

### 6.3.1. Contraintes de Longueur

Pour les patterns complexes, l'analyseur calcule les bornes de longueur minimale et maximale. Par exemple, le pattern `a..b` a une longueur exacte de 4, permettant d'ajouter `LENGTH(term) = 4` à la requête SQL.

## 6.4. Construction de la Requête SQL

Le module `SqlQueryBuilder` génère une clause WHERE optimisée :

```typescript
interface SqlQuery {
  whereClause: string;      // Clause WHERE
  parameters: any[];        // Paramètres bindés
  needsNfaFiltering: boolean; // NFA encore nécessaire?
}
```

### 6.4.2. Indicateur NFA

L'attribut `needsNfaFiltering` indique si le filtrage SQL est suffisant :
- `false` pour `exact`, `alternation`, `sql_pattern` : le SQL est exact
- `true` pour les autres : validation NFA requise


## 6.6. Pipeline Complette

```typescript
function searchRegex(pattern: string): SearchResult[] {
  // 1. Parser le pattern
  const syntaxTree = parseRegex(pattern);
  const nfa = nfaFromSyntaxTree(syntaxTree);

  // 2. Analyser pour optimisation SQL
  const analysis = analyzeSqlPattern(syntaxTree);
  const sqlQuery = buildSqlQuery(analysis, "term");

  // 3. Récupérer les candidats
  const candidates = db.prepare(`
    SELECT DISTINCT term FROM term_stats
    WHERE ${sqlQuery.whereClause}
  `).all(...sqlQuery.parameters);

  // 4. Filtrer avec NFA si nécessaire
  let matchingTerms: string[];
  if (sqlQuery.needsNfaFiltering) {
    const matcher = new NfaMatcher(nfa);
    matchingTerms = candidates
      .filter(t => matcher.match(t.term));
  } else {
    matchingTerms = candidates.map(t => t.term);
  }

  // 5. Récupérer les livres contenant ces termes
  return findBooksWithTerms(matchingTerms);
}
```


