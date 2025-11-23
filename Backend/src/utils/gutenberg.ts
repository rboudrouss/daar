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

  for (const url of urls) {
    try {
      console.log(`Trying to download from: ${url}`);
      const response = await fetch(url);

      if (response.ok) {
        const text = await response.text();
        console.log(`Successfully downloaded book ${bookId} from ${url}`);
        return text;
      }
    } catch (error) {
      console.log(`Failed to download from ${url}`);
      continue;
    }
  }

  console.log(`Could not download book ${bookId} from any URL`);
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
    console.log(`Trying to download cover from: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      console.log(`Cover not available for book ${bookId}`);
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

    console.log(`Successfully downloaded cover for book ${bookId}`);
    return filepath;
  } catch (error) {
    console.log(`Failed to download cover for book ${bookId}:`, error);
    return null;
  }
}

/**
 * Récupère les métadonnées d'un livre depuis l'API Gutendex
 */
export async function fetchGutendexMetadata(
  bookId: number
): Promise<GutendexMetadata | null> {
  const url = `https://gutendex.com/books/${bookId}`;

  try {
    console.log(`Fetching metadata from Gutendex API: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      console.log(`Metadata not available for book ${bookId}`);
      return null;
    }

    const data = (await response.json()) as GutendexMetadata;
    console.log(`Successfully fetched metadata for book ${bookId}: ${data.title}`);
    return data;
  } catch (error) {
    console.log(`Failed to fetch metadata for book ${bookId}:`, error);
    return null;
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

  // Chercher le titre et l'auteur dans les premières lignes
  for (let i = 0; i < Math.min(100, lines.length); i++) {
    const line = lines[i].trim();

    // Chercher "Title:"
    if (line.match(/^Title:\s*/i)) {
      title = line.replace(/^Title:\s*/i, "").trim();
    }

    // Chercher "Author:"
    if (line.match(/^Author:\s*/i)) {
      author = line.replace(/^Author:\s*/i, "").trim();
    }

    // Arrêter après "*** START OF"
    if (line.includes("*** START OF")) {
      break;
    }
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
 */
export async function downloadGutenbergBook(
  bookId: number
): Promise<GutenbergBook | null> {
  // Récupérer les métadonnées depuis Gutendex API
  const metadata = await fetchGutendexMetadata(bookId);

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
    }

    console.log(`Using Gutendex metadata: "${title}" by ${author}`);
  } else {
    // Fallback: utiliser des valeurs par défaut
    title = `Gutenberg Book ${bookId}`;
    author = "Unknown Author";
    console.log(`Using fallback metadata for book ${bookId}`);
  }

  // Télécharger le texte en utilisant les URLs de Gutendex
  const text = await downloadGutenbergText(bookId, metadata);
  if (!text) {
    return null;
  }

  // Si on n'a pas de métadonnées Gutendex, essayer d'extraire du texte
  if (!metadata) {
    const extracted = extractGutenbergMetadata(text, bookId);
    title = extracted.title;
    author = extracted.author;
    console.log(`Extracted metadata from text: "${title}" by ${author}`);
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
