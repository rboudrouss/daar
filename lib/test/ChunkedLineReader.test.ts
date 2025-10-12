import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { ChunkedLineReader } from "../src/ChunkedLineReader";

describe("ChunkedLineReader", () => {
  const testDir = path.join(__dirname, "test-files");
  const testFile = path.join(testDir, "chunked-test.txt");

  beforeEach(() => {
    // Créer le répertoire de test
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Nettoyer les fichiers de test
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  describe("lines()", () => {
    it("should read all lines from a simple file", () => {
      const content = "line1\nline2\nline3";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines.length).toBe(3);
      expect(lines[0].line).toBe("line1");
      expect(lines[1].line).toBe("line2");
      expect(lines[2].line).toBe("line3");
    });

    it("should assign correct line numbers", () => {
      const content = "first\nsecond\nthird";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines[0].lineNumber).toBe(1);
      expect(lines[1].lineNumber).toBe(2);
      expect(lines[2].lineNumber).toBe(3);
    });

    it("should handle empty file", () => {
      fs.writeFileSync(testFile, "", "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines.length).toBe(0);
    });

    it("should handle file with single line", () => {
      fs.writeFileSync(testFile, "single line", "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines.length).toBe(1);
      expect(lines[0].line).toBe("single line");
      expect(lines[0].lineNumber).toBe(1);
    });

    it("should handle file with trailing newline", () => {
      const content = "line1\nline2\n";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines.length).toBe(2);
      expect(lines[0].line).toBe("line1");
      expect(lines[1].line).toBe("line2");
    });

    it("should handle file without trailing newline", () => {
      const content = "line1\nline2";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines.length).toBe(2);
      expect(lines[0].line).toBe("line1");
      expect(lines[1].line).toBe("line2");
    });

    it("should handle empty lines", () => {
      const content = "line1\n\nline3";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines.length).toBe(3);
      expect(lines[0].line).toBe("line1");
      expect(lines[1].line).toBe("");
      expect(lines[2].line).toBe("line3");
    });

    it("should handle lines that span multiple chunks", () => {
      // Créer un fichier avec des lignes qui dépassent la taille du chunk
      const longLine = "a".repeat(100);
      const content = `${longLine}\nshort\n${longLine}`;
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile, { chunkSize: 50 });
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines.length).toBe(3);
      expect(lines[0].line).toBe(longLine);
      expect(lines[1].line).toBe("short");
      expect(lines[2].line).toBe(longLine);
    });

    it("should work with custom chunk size", () => {
      const content = "line1\nline2\nline3\nline4\nline5";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile, { chunkSize: 10 });
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines.length).toBe(5);
    });

    it("should handle very small chunk size", () => {
      const content = "abc\ndef\nghi";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile, { chunkSize: 2 });
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines.length).toBe(3);
      expect(lines[0].line).toBe("abc");
      expect(lines[1].line).toBe("def");
      expect(lines[2].line).toBe("ghi");
    });
  });

  describe("linesWithPrefilter()", () => {
    it("should filter lines based on prefilter function", () => {
      const content = "hello\nworld\ntest\nhello world";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const prefilter = (line: string) => line.includes("hello");
      const lines = Array.from(reader.linesWithPrefilter(prefilter));
      reader.close();

      expect(lines.length).toBe(2);
      expect(lines[0].line).toBe("hello");
      expect(lines[1].line).toBe("hello world");
    });

    it("should return all lines when prefilter is null", () => {
      const content = "line1\nline2\nline3";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const lines = Array.from(reader.linesWithPrefilter(null));
      reader.close();

      expect(lines.length).toBe(3);
    });

    it("should return no lines when prefilter rejects all", () => {
      const content = "line1\nline2\nline3";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const prefilter = (line: string) => false;
      const lines = Array.from(reader.linesWithPrefilter(prefilter));
      reader.close();

      expect(lines.length).toBe(0);
    });

    it("should return all lines when prefilter accepts all", () => {
      const content = "line1\nline2\nline3";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const prefilter = (line: string) => true;
      const lines = Array.from(reader.linesWithPrefilter(prefilter));
      reader.close();

      expect(lines.length).toBe(3);
    });

    it("should maintain correct line numbers with prefilter", () => {
      const content = "match\nnomatch\nmatch\nnomatch\nmatch";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const prefilter = (line: string) => line === "match";
      const lines = Array.from(reader.linesWithPrefilter(prefilter));
      reader.close();

      expect(lines.length).toBe(3);
      expect(lines[0].lineNumber).toBe(1);
      expect(lines[1].lineNumber).toBe(3);
      expect(lines[2].lineNumber).toBe(5);
    });

    it("should work with complex prefilter logic", () => {
      const content = "apple\nbanana\ncherry\ndate\neggplant";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const prefilter = (line: string) => line.length > 5;
      const lines = Array.from(reader.linesWithPrefilter(prefilter));
      reader.close();

      expect(lines.length).toBe(3);
      expect(lines.map((l) => l.line)).toEqual(["banana", "cherry", "eggplant"]);
    });
  });

  describe("close()", () => {
    it("should close the file descriptor", () => {
      const content = "line1\nline2";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      reader.close();

      // Vérifier qu'on peut fermer plusieurs fois sans erreur
      expect(() => reader.close()).not.toThrow();
    });

    it("should allow reading after close is called", () => {
      const content = "line1\nline2";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines.length).toBe(2);
    });
  });

  describe("reset()", () => {
    it("should reset reader to beginning of file", () => {
      const content = "line1\nline2\nline3";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const lines1 = Array.from(reader.lines());
      
      reader.reset();
      const lines2 = Array.from(reader.lines());
      reader.close();

      expect(lines1).toEqual(lines2);
    });

    it("should reset line numbers", () => {
      const content = "line1\nline2";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      Array.from(reader.lines());
      
      reader.reset();
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines[0].lineNumber).toBe(1);
      expect(lines[1].lineNumber).toBe(2);
    });

    it("should clear leftover buffer", () => {
      const content = "line1\nline2";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      Array.from(reader.lines());
      
      reader.reset();
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines.length).toBe(2);
    });
  });

  describe("Edge cases", () => {
    it("should handle very long lines", () => {
      const longLine = "x".repeat(100000);
      const content = `${longLine}\nshort`;
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines.length).toBe(2);
      expect(lines[0].line.length).toBe(100000);
      expect(lines[1].line).toBe("short");
    });

    it("should handle file with only newlines", () => {
      const content = "\n\n\n";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines.length).toBe(3);
      expect(lines.every((l) => l.line === "")).toBe(true);
    });

    it("should handle mixed line endings (only \\n supported)", () => {
      const content = "line1\nline2\nline3";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines.length).toBe(3);
    });

    it("should handle unicode characters", () => {
      const content = "héllo\nwörld\n日本語";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines.length).toBe(3);
      expect(lines[0].line).toBe("héllo");
      expect(lines[1].line).toBe("wörld");
      expect(lines[2].line).toBe("日本語");
    });

    it("should handle special characters", () => {
      const content = "tab\there\nquote\"here\nslash\\here";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile);
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines.length).toBe(3);
      expect(lines[0].line).toContain("\t");
      expect(lines[1].line).toContain('"');
      expect(lines[2].line).toContain("\\");
    });
  });

  describe("Custom encoding", () => {
    it("should work with utf-8 encoding (default)", () => {
      const content = "test";
      fs.writeFileSync(testFile, content, "utf-8");

      const reader = new ChunkedLineReader(testFile, { encoding: "utf-8" });
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines[0].line).toBe("test");
    });

    it("should work with ascii encoding", () => {
      const content = "test";
      fs.writeFileSync(testFile, content, "ascii");

      const reader = new ChunkedLineReader(testFile, { encoding: "ascii" });
      const lines = Array.from(reader.lines());
      reader.close();

      expect(lines[0].line).toBe("test");
    });
  });
});

