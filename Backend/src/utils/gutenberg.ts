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

/**
 * Télécharge le texte d'un livre depuis Gutenberg
 */
export async function downloadGutenbergText(
  bookId: number
): Promise<string | null> {
  const urls = [
    `https://www.gutenberg.org/files/${bookId}/${bookId}-0.txt`,
    `https://www.gutenberg.org/files/${bookId}/${bookId}.txt`,
    `https://www.gutenberg.org/files/${bookId}/${bookId}-8.txt`,
  ];

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
 * Télécharge l'image de couverture d'un livre depuis Gutenberg
 */
export async function downloadGutenbergCover(
  bookId: number
): Promise<string | null> {
  const url = `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.cover.medium.jpg`;

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
 * Extrait les métadonnées d'un texte Gutenberg
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
  // Télécharger le texte
  const text = await downloadGutenbergText(bookId);
  if (!text) {
    return null;
  }

  // Extraire les métadonnées
  const { title, author } = extractGutenbergMetadata(text, bookId);

  // Sauvegarder le texte
  const booksDir = "./data/books";
  if (!existsSync(booksDir)) {
    mkdirSync(booksDir, { recursive: true });
  }

  const textFilePath = join(booksDir, `gutenberg-${bookId}.txt`);
  writeFileSync(textFilePath, text, "utf-8");

  // Télécharger la couverture (optionnel)
  const coverImagePath = await downloadGutenbergCover(bookId);

  return {
    id: bookId,
    title,
    author,
    textContent: text,
    textFilePath,
    coverImagePath: coverImagePath || undefined,
  };
}
