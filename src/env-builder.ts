/**
 * Environment file builder for the je tool
 */
import { loadConfig } from "./config.ts";

/**
 * Build the environment file content by merging base and environment-specific variables
 * @param configPath Path to the config file
 * @param environment Environment to build (development, staging, production)
 * @returns Formatted .env file content
 */
export async function buildEnv(configPath: string, environment: string): Promise<string> {
  const config = await loadConfig(configPath);

  // Validate the config has the necessary sections
  if (!config.base)
  {
    throw new Error("Config file must contain a 'base' section");
  }

  if (!config[environment])
  {
    throw new Error(`Config file does not contain a '${environment}' section`);
  }

  // Merge base with the selected environment
  const envVars = { ...config.base, ...config[environment] };

  // Format as .env file content
  return Object.entries(envVars)
    .map(([key, value]) => `${key}=${escapeEnvValue(value)}`)
    .join("\n");
}

/**
 * Escape special characters in environment variable values
 * @param value The value to escape
 * @returns Escaped value
 */
function escapeEnvValue(value: string): string {
  // If the value contains spaces, newlines, or special characters, wrap in quotes
  if (/[\s"'\\$&#]/.test(value))
  {
    // Escape quotes and backslashes
    const escaped = value.replace(/["\\]/g, "\\$&");
    return `"${escaped}"`;
  }
  return value;
}
