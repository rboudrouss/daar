import * as fs from "fs";

/**
 * Lecteur de fichier par chunks avec gestion lazy des lignes
 *
 * Inspiré de grep, ce lecteur:
 * - Lit le fichier par chunks (buffers de taille fixe)
 * - Gère les lignes de manière lazy (ne découpe en lignes que si nécessaire)
 * - Permet un préfiltrage rapide sur les chunks bruts avant de découper en lignes
 * - Gère correctement les lignes qui chevauchent plusieurs chunks
 *
 * Avantages:
 * - Faible empreinte mémoire (ne charge pas tout le fichier)
 * - Permet le préfiltrage rapide sur les chunks
 * - Efficace pour les gros fichiers
 */

export interface LineMatch {
  line: string;
  lineNumber: number;
}

export interface ChunkedLineReaderOptions {
  /** Taille du chunk en octets (défaut: 64KB comme grep) */
  chunkSize?: number;
  /** Encodage du fichier (défaut: 'utf-8') */
  encoding?: BufferEncoding;
}

export class ChunkedLineReader {
  private fd: number;
  private chunkSize: number;
  private encoding: BufferEncoding;
  private buffer: Buffer;
  private position: number = 0;
  private lineNumber: number = 0;
  private leftover: string = "";
  private eof: boolean = false;

  constructor(
    private filename: string,
    options: ChunkedLineReaderOptions = {}
  ) {
    this.chunkSize = options.chunkSize ?? 64 * 1024; // 64KB par défaut
    this.encoding = options.encoding ?? "utf-8";
    this.buffer = Buffer.allocUnsafe(this.chunkSize);
    this.fd = fs.openSync(filename, "r");
  }

  /**
   * Lit le prochain chunk du fichier
   * @returns Le chunk lu sous forme de string, ou null si EOF
   */
  private readChunk(): string | null {
    if (this.eof) {
      return null;
    }

    const bytesRead = fs.readSync(
      this.fd,
      this.buffer,
      0,
      this.chunkSize,
      this.position
    );

    if (bytesRead === 0) {
      this.eof = true;
      return null;
    }

    this.position += bytesRead;

    // Convertir le buffer en string
    return this.buffer.toString(this.encoding, 0, bytesRead);
  }

  /**
   * Itère sur toutes les lignes du fichier
   *
   * @yields {LineMatch} Chaque ligne avec son numéro
   */
  *lines(): Generator<LineMatch> {
    while (true) {
      const chunk = this.readChunk();

      if (chunk === null) {
        // EOF: retourner la dernière ligne s'il y en a une
        if (this.leftover.length > 0) {
          this.lineNumber++;
          yield { line: this.leftover, lineNumber: this.lineNumber };
          this.leftover = "";
        }
        break;
      }

      // Combiner avec le leftover du chunk précédent
      const text = this.leftover + chunk;
      const lines = text.split("\n");

      // Le dernier élément peut être incomplet (pas de \n à la fin)
      this.leftover = lines.pop() || "";

      // Yield chaque ligne complète
      for (const line of lines) {
        this.lineNumber++;
        yield { line, lineNumber: this.lineNumber };
      }
    }
  }

  /**
   * Itère sur toutes les lignes avec préfiltrage
   *
   * Cette méthode permet d'appliquer un préfiltre rapide sur les lignes
   * avant de les découper en lignes. Cela évite de découper inutilement
   * les lignes qui ne contiennent pas le motif recherché.
   *
   * @param prefilter Fonction de préfiltrage qui retourne true si la ligne peut contenir des matches
   * @yields {LineMatch} Chaque ligne qui passe le préfiltre
   */
  *linesWithPrefilter(
    prefilter: null | ((line: string) => boolean)
  ): Generator<LineMatch> {
    if (!prefilter) {
      yield* this.lines();
      return;
    }

    while (true) {
      const chunk = this.readChunk();

      if (chunk === null) {
        // EOF: retourner la dernière ligne s'il y en a une
        if (this.leftover.length > 0) {
          this.lineNumber++;
          if (prefilter(this.leftover)) {
            yield { line: this.leftover, lineNumber: this.lineNumber };
          }
          this.leftover = "";
        }
        break;
      }

      // Combiner avec le leftover du chunk précédent
      const text = this.leftover + chunk;
      const lines = text.split("\n");

      // Le dernier élément peut être incomplet (pas de \n à la fin)
      this.leftover = lines.pop() || "";

      // Pour chaque ligne, incrémenter le numéro et appliquer le préfiltre
      for (const line of lines) {
        this.lineNumber++;
        if (prefilter(line)) {
          yield { line, lineNumber: this.lineNumber };
        }
      }
    }
  }

  /**
   * Ferme le fichier
   */
  close(): void {
    if (this.fd !== -1) {
      fs.closeSync(this.fd);
      this.fd = -1;
    }
  }

  /**
   * Réinitialise le lecteur pour relire le fichier depuis le début
   */
  reset(): void {
    this.position = 0;
    this.lineNumber = 0;
    this.leftover = "";
    this.eof = false;
  }
}
