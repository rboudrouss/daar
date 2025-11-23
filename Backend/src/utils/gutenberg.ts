/**
 * Utilitaires pour télécharger des livres depuis Project Gutenberg
 */

import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export interface GutenbergBook {
  id: number;
  title: string;
  author: string;
  textContent: string;
  textFilePath: string;
  coverImagePath?: string;
}

export interface GutendexAuthor {
  name: string;
  birth_year: number | null;
  death_year: number | null;
}

export interface GutendexMetadata {
  id: number;
  title: string;
  authors: GutendexAuthor[];
  summaries: string[];
  subjects: string[];
  bookshelves: string[];
  languages: string[];
  copyright: boolean;
  media_type: string;
  formats: Record<string, string>;
  download_count: number;
}

export interface GutendexBatchResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: GutendexMetadata[];
}

/**
 * Nettoie le texte Gutenberg en supprimant les en-têtes et pieds de page
 */
function cleanGutenbergText(text: string): string {
  const lines = text.split("\n");
  let startIndex = -1;
  let endIndex = -1;

  // Chercher le marqueur de début
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.match(/^\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG EBOOK/i)) {
      startIndex = i + 1; // Commencer après le marqueur
      break;
    }
  }

  // Chercher le marqueur de fin
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.match(/^\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG EBOOK/i)) {
      endIndex = i; // Terminer avant le marqueur
      break;
    }
  }

  // Si on a trouvé les deux marqueurs, extraire le contenu
  if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    const cleanedLines = lines.slice(startIndex, endIndex);
    return cleanedLines.join("\n").trim();
  }

  // Si on n'a pas trouvé les marqueurs, retourner le texte original
  console.warn(
    `Warning: Could not find Gutenberg markers, returning original text`
  );
  return text;
}

/**
 * Télécharge le texte d'un livre depuis Gutenberg en utilisant les URLs de Gutendex
 */
export async function downloadGutenbergText(
  bookId: number,
  metadata?: GutendexMetadata | null
): Promise<string | null> {
  let urls: string[] = [];

  // Si on a les métadonnées Gutendex, utiliser les URLs des formats
  if (metadata?.formats) {
    // Chercher les formats texte dans l'ordre de préférence
    const textFormats = [
      "text/plain; charset=us-ascii",
      "text/plain; charset=utf-8",
      "text/plain",
    ];

    for (const format of textFormats) {
      if (metadata.formats[format]) {
        urls.push(metadata.formats[format]);
      }
    }
  }

  // Fallback: URLs classiques de Gutenberg
  if (urls.length === 0) {
    urls = [
      `https://www.gutenberg.org/files/${bookId}/${bookId}-0.txt`,
      `https://www.gutenberg.org/files/${bookId}/${bookId}.txt`,
      `https://www.gutenberg.org/files/${bookId}/${bookId}-8.txt`,
    ];
  }

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const response = await fetch(url);

      if (response.ok) {
        const rawText = await response.text();
        const cleanedText = cleanGutenbergText(rawText);
        return cleanedText;
      }
    } catch (error) {
      console.error(`[Text Download] Error downloading from ${url}:`, error instanceof Error ? error.message : error);
      continue;
    }
  }

  console.error(`[Text Download] Could not download book ${bookId} from any of the ${urls.length} URL(s)`);
  return null;
}

/**
 * Télécharge l'image de couverture d'un livre depuis Gutenberg en utilisant les URLs de Gutendex
 */
export async function downloadGutenbergCover(
  bookId: number,
  metadata?: GutendexMetadata | null
): Promise<string | null> {
  let url: string;

  // Si on a les métadonnées Gutendex, utiliser l'URL de la couverture
  if (metadata?.formats?.["image/jpeg"]) {
    url = metadata.formats["image/jpeg"]?.replace("small", "medium");
  } else {
    // Fallback: URL classique de Gutenberg
    url = `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.cover.medium.jpg`;
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    // Créer le dossier covers s'il n'existe pas
    const coversDir = "./data/covers";
    if (!existsSync(coversDir)) {
      mkdirSync(coversDir, { recursive: true });
    }

    // Sauvegarder l'image
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filepath = join(coversDir, `gutenberg-${bookId}.jpg`);
    writeFileSync(filepath, buffer);

    return filepath;
  } catch (error) {
    console.error(`[Cover Download] Failed to download cover for book ${bookId}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Sleep helper function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Récupère les métadonnées de plusieurs livres en une seule requête
 */
export async function fetchGutendexMetadataBatch(
  bookIds: number[]
): Promise<Map<number, GutendexMetadata>> {
  const url = `https://gutendex.com/books?ids=${bookIds.join(',')}`;
  const metadataMap = new Map<number, GutendexMetadata>();

  try {
    const response = await fetch(url);

    if (!response.ok) {
      // Retry en cas d'erreur
      if (response.status === 408 || response.status === 429 || response.status >= 500) {
        console.warn(`[Gutendex Batch] Failed with HTTP ${response.status}, retrying in 2s...`);
        await sleep(2000);

        const retryResponse = await fetch(url);
        if (!retryResponse.ok) {
          console.error(`[Gutendex Batch] Retry failed with HTTP ${retryResponse.status}`);
          return metadataMap;
        }

        const retryData = (await retryResponse.json()) as GutendexBatchResponse;
        for (const book of retryData.results) {
          metadataMap.set(book.id, book);

          // Warn if missing critical metadata
          if (!book.title || book.title.trim() === "") {
            console.warn(`[Gutendex] Book ${book.id} has empty title!`);
          }
          if (!book.authors || book.authors.length === 0) {
            console.warn(`[Gutendex] Book ${book.id} has no authors!`);
          }
        }
        return metadataMap;
      }
      console.error(`[Gutendex Batch] Failed with HTTP ${response.status}`);
      return metadataMap;
    }

    const data = (await response.json()) as GutendexBatchResponse;

    for (const book of data.results) {
      metadataMap.set(book.id, book);

      // Warn if missing critical metadata
      if (!book.title || book.title.trim() === "") {
        console.warn(`[Gutendex] Book ${book.id} has empty title!`);
      }
      if (!book.authors || book.authors.length === 0) {
        console.warn(`[Gutendex] Book ${book.id} has no authors!`);
      }
    }

    return metadataMap;
  } catch (error) {
    // Retry en cas d'erreur réseau
    console.warn(`[Gutendex Batch] Network error, retrying in 2s...`);
    await sleep(2000);

    try {
      const retryResponse = await fetch(url);
      if (!retryResponse.ok) {
        console.error(`[Gutendex Batch] Retry failed with HTTP ${retryResponse.status}`);
        return metadataMap;
      }

      const retryData = (await retryResponse.json()) as GutendexBatchResponse;
      for (const book of retryData.results) {
        metadataMap.set(book.id, book);

        // Warn if missing critical metadata
        if (!book.title || book.title.trim() === "") {
          console.warn(`[Gutendex] Book ${book.id} has empty title!`);
        }
        if (!book.authors || book.authors.length === 0) {
          console.warn(`[Gutendex] Book ${book.id} has no authors!`);
        }
      }
      return metadataMap;
    } catch (retryError) {
      console.error(`[Gutendex Batch] Failed after retry:`, retryError);
      return metadataMap;
    }
  }
}

/**
 * Récupère les métadonnées d'un livre depuis l'API Gutendex
 * Retry une fois après 2 secondes en cas d'échec
 */
export async function fetchGutendexMetadata(
  bookId: number
): Promise<GutendexMetadata | null> {
  const url = `https://gutendex.com/books/${bookId}`;

  // Premier essai
  try {
    const response = await fetch(url);

    if (!response.ok) {
      // Si timeout ou erreur serveur, retry après 2 secondes
      if (response.status === 408 || response.status === 429 || response.status >= 500) {
        console.warn(`[Gutendex] Book ${bookId} failed with HTTP ${response.status}, retrying in 2s...`);
        await sleep(2000);

        // Deuxième essai
        try {
          const retryResponse = await fetch(url);
          if (!retryResponse.ok) {
            return null;
          }
          const data = (await retryResponse.json()) as GutendexMetadata;

          // Warn if missing critical metadata
          if (!data.title || data.title.trim() === "") {
            console.warn(`[Gutendex] Book ${bookId} has empty title!`);
          }
          if (!data.authors || data.authors.length === 0) {
            console.warn(`[Gutendex] Book ${bookId} has no authors!`);
          }

          return data;
        } catch (retryError) {
          console.error(`[Gutendex] Retry failed for book ${bookId}:`, retryError);
          return null;
        }
      }
      return null;
    }

    const data = (await response.json()) as GutendexMetadata;

    // Warn if missing critical metadata
    if (!data.title || data.title.trim() === "") {
      console.warn(`[Gutendex] Book ${bookId} has empty title!`);
    }
    if (!data.authors || data.authors.length === 0) {
      console.warn(`[Gutendex] Book ${bookId} has no authors!`);
    }

    return data;
  } catch (error) {
    // En cas d'erreur réseau, retry après 2 secondes
    console.warn(`[Gutendex] Network error for book ${bookId}, retrying in 2s...`);
    await sleep(2000);

    try {
      const retryResponse = await fetch(url);
      if (!retryResponse.ok) {
        return null;
      }
      const data = (await retryResponse.json()) as GutendexMetadata;

      // Warn if missing critical metadata
      if (!data.title || data.title.trim() === "") {
        console.warn(`[Gutendex] Book ${bookId} has empty title!`);
      }
      if (!data.authors || data.authors.length === 0) {
        console.warn(`[Gutendex] Book ${bookId} has no authors!`);
      }

      return data;
    } catch (retryError) {
      console.error(`[Gutendex] Failed to fetch metadata for book ${bookId} after retry:`, retryError);
      return null;
    }
  }
}

/**
 * Extrait les métadonnées d'un texte Gutenberg (fallback)
 */
export function extractGutenbergMetadata(
  text: string,
  bookId: number
): {
  title: string;
  author: string;
} {
  const lines = text.split("\n");
  let title = `Gutenberg Book ${bookId}`;
  let author = "Unknown Author";
  let foundTitle = false;
  let foundAuthor = false;

  // Chercher le titre et l'auteur dans les premières lignes
  for (let i = 0; i < Math.min(100, lines.length); i++) {
    const line = lines[i].trim();

    // Chercher "Title:"
    if (line.match(/^Title:\s*/i)) {
      title = line.replace(/^Title:\s*/i, "").trim();
      foundTitle = true;
    }

    // Chercher "Author:"
    if (line.match(/^Author:\s*/i)) {
      author = line.replace(/^Author:\s*/i, "").trim();
      foundAuthor = true;
    }

    // Arrêter après "*** START OF"
    if (line.includes("*** START OF")) {
      break;
    }
  }

  if (!foundTitle) {
    console.warn(`[Metadata Extraction] Could not find title in text for book ${bookId}, using default`);
  }
  if (!foundAuthor) {
    console.warn(`[Metadata Extraction] Could not find author in text for book ${bookId}, using default`);
  }

  // Nettoyer le titre
  title = title.replace(/[^\w\s\-:,.']/g, "").trim();
  if (title.length > 200) {
    title = title.substring(0, 200) + "...";
  }

  // Nettoyer l'auteur
  author = author.replace(/[^\w\s\-,.]/g, "").trim();
  if (author.length > 100) {
    author = author.substring(0, 100) + "...";
  }

  return { title, author };
}

/**
 * Télécharge un livre complet depuis Gutenberg
 * @param bookId - L'ID du livre Gutenberg
 * @param providedMetadata - Métadonnées optionnelles déjà récupérées (pour éviter un appel API supplémentaire)
 */
export async function downloadGutenbergBook(
  bookId: number,
  providedMetadata?: GutendexMetadata | null
): Promise<GutenbergBook | null> {
  // Utiliser les métadonnées fournies ou les récupérer depuis l'API
  const metadata = providedMetadata !== undefined ? providedMetadata : await fetchGutendexMetadata(bookId);

  let title: string;
  let author: string;

  if (metadata) {
    // Utiliser les métadonnées de Gutendex
    title = metadata.title;

    // Combiner les auteurs
    if (metadata.authors.length > 0) {
      author = metadata.authors.map((a) => a.name).join(", ");
    } else {
      author = "Unknown Author";
      console.warn(`[Book ${bookId}] No authors in Gutendex metadata, using "Unknown Author"`);
    }
  } else {
    // Fallback: utiliser des valeurs par défaut
    title = `Gutenberg Book ${bookId}`;
    author = "Unknown Author";
    console.warn(`[Book ${bookId}] No Gutendex metadata available, using fallback values`);
  }

  // Télécharger le texte en utilisant les URLs de Gutendex
  const text = await downloadGutenbergText(bookId, metadata);
  if (!text) {
    console.error(`[Book ${bookId}] Failed to download text content`);
    return null;
  }

  // Si on n'a pas de métadonnées Gutendex, essayer d'extraire du texte
  if (!metadata) {
    const extracted = extractGutenbergMetadata(text, bookId);
    title = extracted.title;
    author = extracted.author;
  }

  // Sauvegarder le texte
  const booksDir = "./data/books";
  if (!existsSync(booksDir)) {
    mkdirSync(booksDir, { recursive: true });
  }

  const textFilePath = join(booksDir, `gutenberg-${bookId}.txt`);
  writeFileSync(textFilePath, text, "utf-8");

  // Télécharger la couverture en utilisant les URLs de Gutendex
  const coverImagePath = await downloadGutenbergCover(bookId, metadata);

  return {
    id: bookId,
    title,
    author,
    textContent: text,
    textFilePath,
    coverImagePath: coverImagePath || undefined,
  };
}
