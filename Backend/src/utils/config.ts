/**
 * Configuration management - loads from database with fallback to environment variables
 */

import { getDatabase } from "../db/connection.js";

interface ConfigValue {
  key: string;
  value: string;
  type: "string" | "number" | "boolean";
}

/**
 * Get a configuration value from database or environment variable
 */
export function getConfig<T = any>(
  key: string,
  envKey: string,
  defaultValue: T,
  type: "string" | "number" | "boolean" = "string"
): T {
  // Try database first
  try {
    const db = getDatabase();
    const config = db
      .prepare("SELECT value, type FROM app_config WHERE key = ?")
      .get(key) as ConfigValue | undefined;

    if (config) {
      switch (config.type) {
        case "boolean":
          return (config.value === "true") as T;
        case "number":
          return parseFloat(config.value) as T;
        default:
          return config.value as T;
      }
    }
  } catch (error) {
    // Database not available, fall through to env vars
  }

  // Fallback to environment variable
  const envValue = process.env[envKey];
  if (envValue !== undefined) {
    switch (type) {
      case "boolean":
        return (envValue !== "false") as T;
      case "number":
        return parseFloat(envValue) as T;
      default:
        return envValue as T;
    }
  }

  // Return default value
  return defaultValue;
}

/**
 * Update a configuration value in the database
 */
export function updateConfig(
  key: string,
  value: string | number | boolean
): void {
  const db = getDatabase();

  // Convert value to string
  const stringValue = String(value);

  // Update in database
  const stmt = db.prepare(`
    UPDATE app_config
    SET value = ?, updated_at = CURRENT_TIMESTAMP
    WHERE key = ?
  `);

  const result = stmt.run(stringValue, key);

  if (result.changes === 0) {
    throw new Error(`Configuration key '${key}' not found`);
  }
}

/**
 * Get all configuration values
 */
export function getAllConfig(): Record<string, any> {
  const db = getDatabase();
  const configs = db
    .prepare("SELECT key, value, type, description FROM app_config")
    .all() as Array<ConfigValue & { description: string }>;

  const result: Record<string, any> = {};

  for (const config of configs) {
    let parsedValue: any;
    switch (config.type) {
      case "boolean":
        parsedValue = config.value === "true";
        break;
      case "number":
        parsedValue = parseFloat(config.value);
        break;
      default:
        parsedValue = config.value;
    }
    result[config.key] = {
      value: parsedValue,
      type: config.type,
      description: config.description,
    };
  }

  return result;
}

