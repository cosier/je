/**
 * CLI argument processor for the je tool
 */
import { parse } from "jsr:@std/flags";
import { findConfigFile } from "./config.ts";
import { buildEnv } from "./env-builder.ts";

/**
 * Process CLI arguments and execute the appropriate action
 */
export async function processCli(args: string[]): Promise<void> {
  try
  {
    const parsedArgs = parse(args, {
      string: ["file"],
      boolean: ["development", "staging", "production", "help"],
      default: { development: false, staging: false, production: false, help: false },
      alias: { f: "file", h: "help", d: "development", s: "staging", p: "production" },
    });

    if (parsedArgs.help)
    {
      showHelp();
      return;
    }

    // Determine which environment to use
    let environment = "development"; // Default
    if (parsedArgs.production)
    {
      environment = "production";
    } else if (parsedArgs.staging)
    {
      environment = "staging";
    }

    // Find and load the config file
    const configPath = parsedArgs.file || await findConfigFile();

    // Build the environment variables
    const envContent = await buildEnv(configPath, environment);

    // Output to stdout
    console.log(envContent);
  } catch (error)
  {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    Deno.exit(1);
  }
}

/**
 * Display help information
 */
function showHelp(): void {
  console.log(`
je - JSON Environment Variable Builder

USAGE:
  je [OPTIONS]

OPTIONS:
  -h, --help           Show this help message
  -f, --file=<path>    Specify path to the config file (default: .je.jsonc in git root)
  -d, --development    Build for development environment (default)
  -s, --staging        Build for staging environment
  -p, --production     Build for production environment

EXAMPLES:
  je --production      Output production environment variables
  je --file=config.jsonc --staging  Use custom config file for staging env
  `);
}
