/**
 * Utilities for exporting test results to CSV and JSON formats
 */

import * as fs from "fs";
import type { AlgorithmResult } from "./test-execution";

interface TestResult {
  scenario: string;
  results: AlgorithmResult[];
}

interface ExportRow {
  scenario: string;
  pattern: string;
  textLength: number;
  algorithm: string;
  matches: number;
  buildTime: number;
  matchTime: number;
  totalTime: number;
  memoryUsed: number;
  structureNodes?: number;
  structureKB?: number;
}

/**
 * Generate a timestamp-based filename
 */
function generateTimestampFilename(extension: "csv" | "json"): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  return `performance-test-${timestamp}.${extension}`;
}

/**
 * Get the filename to use for export
 */
export function getExportFilename(
  userInput: string | boolean | undefined,
  extension: "csv" | "json"
): string | null {
  if (userInput === undefined || userInput === false) {
    return null;
  }
  if (userInput === true) {
    return generateTimestampFilename(extension);
  }
  return userInput;
}

/**
 * Convert test results to flat rows for export
 */
function flattenResults(
  testResults: TestResult[],
  scenarioMetadata: Map<string, { pattern: string; textLength: number }>
): ExportRow[] {
  const rows: ExportRow[] = [];

  for (const testResult of testResults) {
    const metadata = scenarioMetadata.get(testResult.scenario);
    if (!metadata) continue;

    for (const result of testResult.results) {
      rows.push({
        scenario: testResult.scenario,
        pattern: metadata.pattern,
        textLength: metadata.textLength,
        algorithm: result.algorithm,
        matches: result.matches.length,
        buildTime: result.buildTime,
        matchTime: result.matchTime,
        totalTime: result.totalTime,
        memoryUsed: result.memoryUsed,
        structureNodes: result.structureSize?.nodes,
        structureKB: result.structureSize?.kb,
      });
    }
  }

  return rows;
}

/**
 * Export test results to CSV format
 */
export function exportToCSV(
  testResults: TestResult[],
  scenarioMetadata: Map<string, { pattern: string; textLength: number }>,
  filename: string
): void {
  const rows = flattenResults(testResults, scenarioMetadata);

  if (rows.length === 0) {
    console.log("\nNo results to export to CSV.");
    return;
  }

  // CSV header
  const headers = [
    "Scenario",
    "Pattern",
    "Text Length",
    "Algorithm",
    "Matches",
    "Build Time (ms)",
    "Match Time (ms)",
    "Total Time (ms)",
    "Memory Used (KB)",
    "Structure Nodes",
    "Structure Size (KB)",
  ];

  // Build CSV content
  const csvLines: string[] = [headers.join(",")];

  for (const row of rows) {
    const values = [
      escapeCSV(row.scenario),
      escapeCSV(row.pattern),
      row.textLength,
      escapeCSV(row.algorithm),
      row.matches,
      row.buildTime.toFixed(3),
      row.matchTime.toFixed(3),
      row.totalTime.toFixed(3),
      row.memoryUsed.toFixed(2),
      row.structureNodes ?? "",
      row.structureKB?.toFixed(2) ?? "",
    ];
    csvLines.push(values.join(","));
  }

  // Write to file
  fs.writeFileSync(filename, csvLines.join("\n"), "utf-8");
  console.log(`\n✓ Results exported to CSV: ${filename}`);
}

/**
 * Escape CSV values that contain commas, quotes, or newlines
 */
function escapeCSV(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export test results to JSON format
 */
export function exportToJSON(
  testResults: TestResult[],
  scenarioMetadata: Map<string, { pattern: string; textLength: number }>,
  filename: string
): void {
  const rows = flattenResults(testResults, scenarioMetadata);

  if (rows.length === 0) {
    console.log("\nNo results to export to JSON.");
    return;
  }

  // Create structured JSON output
  const jsonOutput = {
    exportDate: new Date().toISOString(),
    totalScenarios: testResults.length,
    totalResults: rows.length,
    results: rows,
  };

  // Write to file with pretty formatting
  fs.writeFileSync(filename, JSON.stringify(jsonOutput, null, 2), "utf-8");
  console.log(`\n✓ Results exported to JSON: ${filename}`);
}

