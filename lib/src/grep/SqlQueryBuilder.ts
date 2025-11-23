import { SqlPatternAnalysis } from "./PatternAnalyzer";

/**
 * Résultat de la construction d'une requête SQL optimisée
 */
export interface SqlQuery {
  /** La clause WHERE SQL (sans le mot-clé WHERE) */
  whereClause: string;

  /** Les paramètres à binder à la requête */
  parameters: any[];

  /** Indique si un filtrage NFA est encore nécessaire */
  needsNfaFiltering: boolean;
}

/**
 * Construit une requête SQL optimisée basée sur l'analyse du pattern
 *
 * @param analysis L'analyse du pattern regex
 * @param termColumn Le nom de la colonne contenant les termes (par défaut "term")
 * @returns La requête SQL optimisée
 */
export function buildSqlQuery(
  analysis: SqlPatternAnalysis,
  termColumn: string = "term"
): SqlQuery {
  switch (analysis.type) {
    case "exact":
      // Correspondance exacte - pas besoin de NFA
      return {
        whereClause: `${termColumn} = ?`,
        parameters: [analysis.exactLiteral],
        needsNfaFiltering: false,
      };

    case "alternation":
      // Alternation de littéraux - pas besoin de NFA
      if (analysis.alternationLiterals && analysis.alternationLiterals.length > 0) {
        const placeholders = analysis.alternationLiterals.map(() => "?").join(",");
        return {
          whereClause: `${termColumn} IN (${placeholders})`,
          parameters: analysis.alternationLiterals,
          needsNfaFiltering: false,
        };
      }
      break;

    case "prefix":
      // Préfixe littéral - NFA nécessaire pour valider le reste
      if (analysis.prefix) {
        const conditions: string[] = [`${termColumn} LIKE ?`];
        const params: any[] = [`${escapeSqlLike(analysis.prefix)}%`];

        // Ajouter contrainte de longueur minimale si disponible
        if (analysis.minLength !== undefined) {
          conditions.push(`LENGTH(${termColumn}) >= ?`);
          params.push(analysis.minLength);
        }

        return {
          whereClause: conditions.join(" AND "),
          parameters: params,
          needsNfaFiltering: true,
        };
      }
      break;

    case "suffix":
      // Suffixe littéral - NFA nécessaire pour valider le reste
      if (analysis.suffix) {
        const conditions: string[] = [`${termColumn} LIKE ?`];
        const params: any[] = [`%${escapeSqlLike(analysis.suffix)}`];

        // Ajouter contrainte de longueur minimale si disponible
        if (analysis.minLength !== undefined) {
          conditions.push(`LENGTH(${termColumn}) >= ?`);
          params.push(analysis.minLength);
        }

        return {
          whereClause: conditions.join(" AND "),
          parameters: params,
          needsNfaFiltering: true,
        };
      }
      break;

    case "contains":
      // Contient des littéraux - NFA nécessaire pour valider l'ordre et les wildcards
      if (analysis.requiredLiterals && analysis.requiredLiterals.length > 0) {
        const conditions: string[] = [];
        const params: any[] = [];

        // Utiliser le littéral le plus long pour le filtrage
        const longestLiteral = analysis.requiredLiterals[0];
        conditions.push(`${termColumn} LIKE ?`);
        params.push(`%${escapeSqlLike(longestLiteral)}%`);

        // Ajouter contraintes de longueur si disponibles
        if (analysis.exactLength !== undefined) {
          conditions.push(`LENGTH(${termColumn}) = ?`);
          params.push(analysis.exactLength);
        } else {
          if (analysis.minLength !== undefined) {
            conditions.push(`LENGTH(${termColumn}) >= ?`);
            params.push(analysis.minLength);
          }
          if (analysis.maxLength !== undefined) {
            conditions.push(`LENGTH(${termColumn}) <= ?`);
            params.push(analysis.maxLength);
          }
        }

        return {
          whereClause: conditions.join(" AND "),
          parameters: params,
          needsNfaFiltering: true,
        };
      }
      break;

    case "complex":
      // Pattern complexe sans littéraux - pas d'optimisation possible
      // Retourner tous les termes
      break;
  }

  // Fallback: pas de filtrage SQL, retourner tous les termes
  return {
    whereClause: "1=1",
    parameters: [],
    needsNfaFiltering: true,
  };
}

/**
 * Échappe les caractères spéciaux SQL LIKE (% et _)
 *
 * @param literal Le littéral à échapper
 * @returns Le littéral échappé
 */
function escapeSqlLike(literal: string): string {
  return literal.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

