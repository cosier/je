# /mnt/raid0/developer/ext/je/src/cli.ts

/**
 * CLI argument processor for the je tool
 */
import { parse } from "@std/flags";
import { findConfigFile } from "./config.ts";
import { buildEnv } from "./env-builder.ts";

/**
 * Process CLI arguments and execute the appropriate action
 */
export async function processCli(args: string[]): Promise<void> {
  try {
    const parsedArgs = parse(args, {
      string: ["file"],
      boolean: ["development", "staging", "production", "help"],
      default: { development: false, staging: false, production: false, help: false },
      alias: { f: "file", h: "help", d: "development", s: "staging", p: "production" },
    });

    if (parsedArgs.help) {
      showHelp();
      return;
    }

    // Determine which environment to use
    let environment = "development"; // Default
    if (parsedArgs.production) {
      environment = "production";
    } else if (parsedArgs.staging) {
      environment = "staging";
    }

    // Find and load the config file
    const configPath = parsedArgs.file || await findConfigFile();
    
    // Build the environment variables
    const envContent = await buildEnv(configPath, environment);
    
    // Output to stdout
    console.log(envContent);
  } catch (error) {
    console.error(`Error: ${error.message}`);
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


---

# /mnt/raid0/developer/ext/je/src/config.ts

/**
 * Configuration file handler for the je tool
 */
import { parse as parseJsonc } from "@std/jsonc";
import { exists } from "@std/fs";
import { join } from "@std/path";
import { findGitRoot } from "./git.ts";

/**
 * Find the config file in the git root directory
 * @returns The path to the config file
 */
export async function findConfigFile(): Promise<string> {
  try {
    const gitRoot = await findGitRoot();
    const defaultConfig = join(gitRoot, ".je.jsonc");
    
    if (await exists(defaultConfig)) {
      return defaultConfig;
    }
    
    throw new Error("Could not find .je.jsonc config file in git root directory");
  } catch (error) {
    throw new Error(`Failed to locate config file: ${error.message}`);
  }
}

/**
 * Interface for the environment configuration file structure
 */
export interface EnvConfig {
  base?: Record<string, string>;
  development?: Record<string, string>;
  staging?: Record<string, string>;
  production?: Record<string, string>;
  [key: string]: Record<string, string> | undefined;
}

/**
 * Load and parse the JSONC config file
 * @param configPath Path to the config file
 * @returns Parsed config object
 */
export async function loadConfig(configPath: string): Promise<EnvConfig> {
  try {
    const content = await Deno.readTextFile(configPath);
    return parseJsonc(content) as EnvConfig;
  } catch (error) {
    throw new Error(`Failed to load or parse config file: ${error.message}`);
  }
}


---

# /mnt/raid0/developer/ext/je/src/env-builder.ts

/**
 * Environment file builder for the je tool
 */
import { loadConfig, EnvConfig } from "./config.ts";

/**
 * Build the environment file content by merging base and environment-specific variables
 * @param configPath Path to the config file
 * @param environment Environment to build (development, staging, production)
 * @returns Formatted .env file content
 */
export async function buildEnv(configPath: string, environment: string): Promise<string> {
  const config = await loadConfig(configPath);
  
  // Validate the config has the necessary sections
  if (!config.base) {
    throw new Error("Config file must contain a 'base' section");
  }
  
  if (!config[environment]) {
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
  if (/[\s"'\\$&#]/.test(value)) {
    // Escape quotes and backslashes
    const escaped = value.replace(/["\\]/g, "\\$&");
    return `"${escaped}"`;
  }
  return value;
}


---

# /mnt/raid0/developer/ext/je/src/git.ts

/**
 * Git repository utilities for the je tool
 */
import { join, dirname } from "@std/path";
import { exists } from "@std/fs";

/**
 * Find the root directory of the current git repository
 * @param startDir Directory to start the search from (defaults to current directory)
 * @returns The absolute path to the git repository root
 */
export async function findGitRoot(startDir: string = Deno.cwd()): Promise<string> {
  let currentDir = startDir;
  
  while (true) {
    const gitDir = join(currentDir, ".git");
    if (await exists(gitDir)) {
      return currentDir;
    }
    
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error("Could not find git repository root");
    }
    
    currentDir = parentDir;
  }
}


---

# /mnt/raid0/developer/ext/je/tests/env-builder.test.ts

import { assertEquals, assertRejects } from "@std/assert";
import { buildEnv } from "../src/env-builder.ts";
import { join } from "@std/path";

const testDir = join(Deno.cwd(), "tests");
const testConfigPath = join(testDir, "fixtures", "test-config.jsonc");

Deno.test({
  name: "Env Builder Tests",
  fn: async (t) => {
    await t.step("should build development environment", async () => {
      const env = await buildEnv(testConfigPath, "development");
      
      assertEquals(env.includes("NODE_ENV=development"), true);
      assertEquals(env.includes("APP_NAME=je-test-app"), true);
      assertEquals(env.includes("DEBUG=true"), true);
      assertEquals(env.includes('COMPLEX_VALUE="value with spaces"'), true);
      assertEquals(env.includes("API_URL=http://localhost:3000"), true);
      assertEquals(env.includes("APP_ENV=development"), true);
    });
    
    await t.step("should build production environment", async () => {
      const env = await buildEnv(testConfigPath, "production");
      
      assertEquals(env.includes("NODE_ENV=production"), true);
      assertEquals(env.includes("APP_NAME=je-test-app"), true);
      assertEquals(env.includes("DEBUG=false"), true);
      assertEquals(env.includes('COMPLEX_VALUE="value with spaces"'), true);
      assertEquals(env.includes("API_URL=https://api.example.com"), true);
      assertEquals(env.includes("APP_ENV=production"), true);
    });
    
    await t.step("should throw error for missing environment", async () => {
      await assertRejects(
        () => buildEnv(testConfigPath, "nonexistent"),
        Error,
        "Config file does not contain a 'nonexistent' section"
      );
    });
  },
});


---

# /mnt/raid0/developer/ext/je/docs/context.md

# Project Context

## Project Overview
`je` (JSON Environment) is a CLI tool that builds `.env` files from JSONC configuration files.

## Key Features
- Uses JSONC (JSON with Comments) for configuration
- Combines base environment variables with environment-specific ones
- Supports development, staging, and production environments
- Automatically finds the git repository root
- Written in TypeScript for Deno with JSR packages only

## Core Concepts
1. **Config File Format**: A JSONC file with `base` section and environment-specific sections
2. **Environment Merging**: Base variables are combined with environment-specific ones
3. **Git Integration**: Automatically locates the git root to find config files

## Architecture
- **CLI Module**: Handles command-line arguments and flags
- **Config Module**: Finds and parses JSONC configuration
- **Git Module**: Locates git repository root
- **Environment Builder**: Merges and formats environment variables

## Technical Decisions
- Using only JSR imports (no HTTPS imports)
- Using JSONC format to allow comments in configuration
- CLI tool outputs to stdout for maximum flexibility
- Default config file location is `.je.jsonc` in git root directory

## Development Status
- Initial implementation

## Future Considerations
- Potential support for additional output formats
- Potential support for environment variable validation


---

# /mnt/raid0/developer/ext/je/docs/getting-started.md

# Getting Started with je

This guide will help you get started with the `je` (JSON Environment) CLI tool.

## Installation

### Prerequisites
- Deno runtime (version 1.x or higher)
- Git (required for automatic config file detection)

### Install via Deno

```bash
# Install directly from source
deno install -A -n je https://raw.githubusercontent.com/<username>/je/main/mod.ts
```

### Manual Installation

```bash
# Clone the repository
git clone <repository-url>
cd je

# Build the binary
deno task build

# Add to your PATH or create a symlink
ln -s "$(pwd)/je" /usr/local/bin/je  # On macOS/Linux
```

## Creating Your First Configuration File

1. Create a `.je.jsonc` file in your project's git root directory:

```jsonc
{
  // Base configuration for all environments
  "base": {
    "NODE_ENV": "development",
    "APP_NAME": "my-first-app",
    "DEBUG": "true",
    "PORT": "3000"
  },
  
  // Development specific overrides
  "development": {
    "API_URL": "http://localhost:3000",
    "DATABASE_URL": "postgres://user:pass@localhost:5432/mydb"
  },
  
  // Staging specific overrides
  "staging": {
    "NODE_ENV": "staging",
    "API_URL": "https://staging-api.example.com",
    "DATABASE_URL": "postgres://user:pass@staging-db:5432/mydb"
  },
  
  // Production specific overrides
  "production": {
    "NODE_ENV": "production",
    "DEBUG": "false",
    "API_URL": "https://api.example.com",
    "DATABASE_URL": "postgres://user:pass@prod-db:5432/mydb"
  }
}
```

## Basic Usage

### Generate Environment Files

```bash
# Generate development environment (default)
je > .env.development

# Generate production environment
je --production > .env.production

# Generate staging environment
je --staging > .env.staging
```

### Using a Custom Config File

```bash
# Specify a custom config file path
je --file=/path/to/my-config.jsonc --production > .env
```

## Advanced Usage

### Integration with Docker

You can use `je` to generate environment files for Docker containers:

```bash
# Generate environment file for Docker Compose
je --production > .env

# Or pipe directly into Docker run
docker run --env-file <(je --production) my-image
```

### Integration with Build Scripts

Add to your package.json:

```json
{
  "scripts": {
    "prebuild": "je --production > .env.production",
    "build": "..."
  }
}
```

### Shell Integration

Add to your shell profile:

```bash
# Add this to your .bashrc or .zshrc
loadenv() {
  export $(je "$@" | xargs)
}

# Usage: 
# loadenv --production
```

## Troubleshooting

### Error: "Could not find git repository root"

Make sure you're running `je` within a git repository. If you need to use it outside a git repository, specify the config file path explicitly:

```bash
je --file=/absolute/path/to/config.jsonc
```

### Error: "Could not find .je.jsonc config file in git root directory"

Create a `.je.jsonc` file in your git repository root, or specify a custom config file path with the `--file` option.


---

# /mnt/raid0/developer/ext/je/docs/implementation.md

# Implementation Details

## Architecture

The `je` CLI tool is designed with a modular architecture consisting of the following components:

### 1. CLI Module (`src/cli.ts`)
- Entry point for processing command-line arguments
- Uses `@std/flags` to parse command-line flags
- Dispatches to appropriate functions based on arguments
- Handles error reporting and help display

### 2. Config Module (`src/config.ts`)
- Responsible for finding and loading the configuration file
- Parses JSONC content using `@std/jsonc`
- Defines the configuration file structure interface
- Handles validation of required configuration sections

### 3. Git Module (`src/git.ts`)
- Utility for finding the git repository root
- Recursively searches parent directories for a `.git` directory
- Provides functionality for locating default config file

### 4. Environment Builder (`src/env-builder.ts`)
- Core logic for merging environment variables
- Combines base variables with environment-specific ones
- Handles escaping of special characters in env values
- Formats output according to .env file conventions

## Data Flow

1. User invokes CLI with arguments
2. CLI module parses arguments and determines the target environment
3. Config module locates and loads the configuration file
4. Environment builder merges base and environment-specific variables
5. Formatted environment file content is output to stdout

## Config File Format

The configuration file uses JSONC format to allow comments, with the following structure:

```jsonc
{
  // Base environment variables (required)
  "base": {
    "KEY1": "value1",
    "KEY2": "value2"
  },
  
  // Environment-specific overrides
  "development": {
    "KEY1": "override-value1"
  },
  
  "staging": {
    // ...
  },
  
  "production": {
    // ...
  }
}
```

## Value Escaping

Environment variable values are automatically escaped according to the following rules:

- Values with spaces, newlines, or special characters are wrapped in double quotes
- Double quotes and backslashes within values are escaped with a backslash
- Simple values without special characters are left as-is

## Error Handling

The tool provides clear error messages for common issues:
- Missing configuration file
- Invalid JSONC syntax
- Missing required sections in configuration
- Non-existent environment specified

## Future Enhancements

1. Variable interpolation (`${VAR}` syntax)
2. Environment variable validation
3. Support for complex data structures (lists, nested objects)
4. Secret management integration


---

# /mnt/raid0/developer/ext/je/docs/src.md

# /mnt/raid0/developer/ext/je/src/cli.ts

/**
 * CLI argument processor for the je tool
 */
import { parse } from "@std/flags";
import { findConfigFile } from "./config.ts";
import { buildEnv } from "./env-builder.ts";

/**
 * Process CLI arguments and execute the appropriate action
 */
export async function processCli(args: string[]): Promise<void> {
  try {
    const parsedArgs = parse(args, {
      string: ["file"],
      boolean: ["development", "staging", "production", "help"],
      default: { development: false, staging: false, production: false, help: false },
      alias: { f: "file", h: "help", d: "development", s: "staging", p: "production" },
    });

    if (parsedArgs.help) {
      showHelp();
      return;
    }

    // Determine which environment to use
    let environment = "development"; // Default
    if (parsedArgs.production) {
      environment = "production";
    } else if (parsedArgs.staging) {
      environment = "staging";
    }

    // Find and load the config file
    const configPath = parsedArgs.file || await findConfigFile();
    
    // Build the environment variables
    const envContent = await buildEnv(configPath, environment);
    
    // Output to stdout
    console.log(envContent);
  } catch (error) {
    console.error(`Error: ${error.message}`);
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


---

# /mnt/raid0/developer/ext/je/src/config.ts

/**
 * Configuration file handler for the je tool
 */
import { parse as parseJsonc } from "@std/jsonc";
import { exists } from "@std/fs";
import { join } from "@std/path";
import { findGitRoot } from "./git.ts";

/**
 * Find the config file in the git root directory
 * @returns The path to the config file
 */
export async function findConfigFile(): Promise<string> {
  try {
    const gitRoot = await findGitRoot();
    const defaultConfig = join(gitRoot, ".je.jsonc");
    
    if (await exists(defaultConfig)) {
      return defaultConfig;
    }
    
    throw new Error("Could not find .je.jsonc config file in git root directory");
  } catch (error) {
    throw new Error(`Failed to locate config file: ${error.message}`);
  }
}

/**
 * Interface for the environment configuration file structure
 */
export interface EnvConfig {
  base?: Record<string, string>;
  development?: Record<string, string>;
  staging?: Record<string, string>;
  production?: Record<string, string>;
  [key: string]: Record<string, string> | undefined;
}

/**
 * Load and parse the JSONC config file
 * @param configPath Path to the config file
 * @returns Parsed config object
 */
export async function loadConfig(configPath: string): Promise<EnvConfig> {
  try {
    const content = await Deno.readTextFile(configPath);
    return parseJsonc(content) as EnvConfig;
  } catch (error) {
    throw new Error(`Failed to load or parse config file: ${error.message}`);
  }
}


---

# /mnt/raid0/developer/ext/je/src/env-builder.ts

/**
 * Environment file builder for the je tool
 */
import { loadConfig, EnvConfig } from "./config.ts";

/**
 * Build the environment file content by merging base and environment-specific variables
 * @param configPath Path to the config file
 * @param environment Environment to build (development, staging, production)
 * @returns Formatted .env file content
 */
export async function buildEnv(configPath: string, environment: string): Promise<string> {
  const config = await loadConfig(configPath);
  
  // Validate the config has the necessary sections
  if (!config.base) {
    throw new Error("Config file must contain a 'base' section");
  }
  
  if (!config[environment]) {
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
  if (/[\s"'\\$&#]/.test(value)) {
    // Escape quotes and backslashes
    const escaped = value.replace(/["\\]/g, "\\$&");
    return `"${escaped}"`;
  }
  return value;
}


---

# /mnt/raid0/developer/ext/je/src/git.ts

/**
 * Git repository utilities for the je tool
 */
import { join, dirname } from "@std/path";
import { exists } from "@std/fs";

/**
 * Find the root directory of the current git repository
 * @param startDir Directory to start the search from (defaults to current directory)
 * @returns The absolute path to the git repository root
 */
export async function findGitRoot(startDir: string = Deno.cwd()): Promise<string> {
  let currentDir = startDir;
  
  while (true) {
    const gitDir = join(currentDir, ".git");
    if (await exists(gitDir)) {
      return currentDir;
    }
    
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error("Could not find git repository root");
    }
    
    currentDir = parentDir;
  }
}


---

# /mnt/raid0/developer/ext/je/tests/env-builder.test.ts

import { assertEquals, assertRejects } from "@std/assert";
import { buildEnv } from "../src/env-builder.ts";
import { join } from "@std/path";

const testDir = join(Deno.cwd(), "tests");
const testConfigPath = join(testDir, "fixtures", "test-config.jsonc");

Deno.test({
  name: "Env Builder Tests",
  fn: async (t) => {
    await t.step("should build development environment", async () => {
      const env = await buildEnv(testConfigPath, "development");
      
      assertEquals(env.includes("NODE_ENV=development"), true);
      assertEquals(env.includes("APP_NAME=je-test-app"), true);
      assertEquals(env.includes("DEBUG=true"), true);
      assertEquals(env.includes('COMPLEX_VALUE="value with spaces"'), true);
      assertEquals(env.includes("API_URL=http://localhost:3000"), true);
      assertEquals(env.includes("APP_ENV=development"), true);
    });
    
    await t.step("should build production environment", async () => {
      const env = await buildEnv(testConfigPath, "production");
      
      assertEquals(env.includes("NODE_ENV=production"), true);
      assertEquals(env.includes("APP_NAME=je-test-app"), true);
      assertEquals(env.includes("DEBUG=false"), true);
      assertEquals(env.includes('COMPLEX_VALUE="value with spaces"'), true);
      assertEquals(env.includes("API_URL=https://api.example.com"), true);
      assertEquals(env.includes("APP_ENV=production"), true);
    });
    
    await t.step("should throw error for missing environment", async () => {
      await assertRejects(
        () => buildEnv(testConfigPath, "nonexistent"),
        Error,
        "Config file does not contain a 'nonexistent' section"
      );
    });
  },
});


---

# /mnt/raid0/developer/ext/je/docs/context.md

# Project Context

## Project Overview
`je` (JSON Environment) is a CLI tool that builds `.env` files from JSONC configuration files.

## Key Features
- Uses JSONC (JSON with Comments) for configuration
- Combines base environment variables with environment-specific ones
- Supports development, staging, and production environments
- Automatically finds the git repository root
- Written in TypeScript for Deno with JSR packages only

## Core Concepts
1. **Config File Format**: A JSONC file with `base` section and environment-specific sections
2. **Environment Merging**: Base variables are combined with environment-specific ones
3. **Git Integration**: Automatically locates the git root to find config files

## Architecture
- **CLI Module**: Handles command-line arguments and flags
- **Config Module**: Finds and parses JSONC configuration
- **Git Module**: Locates git repository root
- **Environment Builder**: Merges and formats environment variables

## Technical Decisions
- Using only JSR imports (no HTTPS imports)
- Using JSONC format to allow comments in configuration
- CLI tool outputs to stdout for maximum flexibility
- Default config file location is `.je.jsonc` in git root directory

## Development Status
- Initial implementation

## Future Considerations
- Potential support for additional output formats
- Potential support for environment variable validation


---

# /mnt/raid0/developer/ext/je/docs/getting-started.md

# Getting Started with je

This guide will help you get started with the `je` (JSON Environment) CLI tool.

## Installation

### Prerequisites
- Deno runtime (version 1.x or higher)
- Git (required for automatic config file detection)

### Install via Deno

```bash
# Install directly from source
deno install -A -n je https://raw.githubusercontent.com/<username>/je/main/mod.ts
```

### Manual Installation

```bash
# Clone the repository
git clone <repository-url>
cd je

# Build the binary
deno task build

# Add to your PATH or create a symlink
ln -s "$(pwd)/je" /usr/local/bin/je  # On macOS/Linux
```

## Creating Your First Configuration File

1. Create a `.je.jsonc` file in your project's git root directory:

```jsonc
{
  // Base configuration for all environments
  "base": {
    "NODE_ENV": "development",
    "APP_NAME": "my-first-app",
    "DEBUG": "true",
    "PORT": "3000"
  },
  
  // Development specific overrides
  "development": {
    "API_URL": "http://localhost:3000",
    "DATABASE_URL": "postgres://user:pass@localhost:5432/mydb"
  },
  
  // Staging specific overrides
  "staging": {
    "NODE_ENV": "staging",
    "API_URL": "https://staging-api.example.com",
    "DATABASE_URL": "postgres://user:pass@staging-db:5432/mydb"
  },
  
  // Production specific overrides
  "production": {
    "NODE_ENV": "production",
    "DEBUG": "false",
    "API_URL": "https://api.example.com",
    "DATABASE_URL": "postgres://user:pass@prod-db:5432/mydb"
  }
}
```

## Basic Usage

### Generate Environment Files

```bash
# Generate development environment (default)
je > .env.development

# Generate production environment
je --production > .env.production

# Generate staging environment
je --staging > .env.staging
```

### Using a Custom Config File

```bash
# Specify a custom config file path
je --file=/path/to/my-config.jsonc --production > .env
```

## Advanced Usage

### Integration with Docker

You can use `je` to generate environment files for Docker containers:

```bash
# Generate environment file for Docker Compose
je --production > .env

# Or pipe directly into Docker run
docker run --env-file <(je --production) my-image
```

### Integration with Build Scripts

Add to your package.json:

```json
{
  "scripts": {
    "prebuild": "je --production > .env.production",
    "build": "..."
  }
}
```

### Shell Integration

Add to your shell profile:

```bash
# Add this to your .bashrc or .zshrc
loadenv() {
  export $(je "$@" | xargs)
}

# Usage: 
# loadenv --production
```

## Troubleshooting

### Error: "Could not find git repository root"

Make sure you're running `je` within a git repository. If you need to use it outside a git repository, specify the config file path explicitly:

```bash
je --file=/absolute/path/to/config.jsonc
```

### Error: "Could not find .je.jsonc config file in git root directory"

Create a `.je.jsonc` file in your git repository root, or specify a custom config file path with the `--file` option.


---

# /mnt/raid0/developer/ext/je/docs/implementation.md

# Implementation Details

## Architecture

The `je` CLI tool is designed with a modular architecture consisting of the following components:

### 1. CLI Module (`src/cli.ts`)
- Entry point for processing command-line arguments
- Uses `@std/flags` to parse command-line flags
- Dispatches to appropriate functions based on arguments
- Handles error reporting and help display

### 2. Config Module (`src/config.ts`)
- Responsible for finding and loading the configuration file
- Parses JSONC content using `@std/jsonc`
- Defines the configuration file structure interface
- Handles validation of required configuration sections

### 3. Git Module (`src/git.ts`)
- Utility for finding the git repository root
- Recursively searches parent directories for a `.git` directory
- Provides functionality for locating default config file

### 4. Environment Builder (`src/env-builder.ts`)
- Core logic for merging environment variables
- Combines base variables with environment-specific ones
- Handles escaping of special characters in env values
- Formats output according to .env file conventions

## Data Flow

1. User invokes CLI with arguments
2. CLI module parses arguments and determines the target environment
3. Config module locates and loads the configuration file
4. Environment builder merges base and environment-specific variables
5. Formatted environment file content is output to stdout

## Config File Format

The configuration file uses JSONC format to allow comments, with the following structure:

```jsonc
{
  // Base environment variables (required)
  "base": {
    "KEY1": "value1",
    "KEY2": "value2"
  },
  
  // Environment-specific overrides
  "development": {
    "KEY1": "override-value1"
  },
  
  "staging": {
    // ...
  },
  
  "production": {
    // ...
  }
}
```

## Value Escaping

Environment variable values are automatically escaped according to the following rules:

- Values with spaces, newlines, or special characters are wrapped in double quotes
- Double quotes and backslashes within values are escaped with a backslash
- Simple values without special characters are left as-is

## Error Handling

The tool provides clear error messages for common issues:
- Missing configuration file
- Invalid JSONC syntax
- Missing required sections in configuration
- Non-existent environment specified

## Future Enhancements

1. Variable interpolation (`${VAR}` syntax)
2. Environment variable validation
3. Support for complex data structures (lists, nested objects)
4. Secret management integration


---

# /mnt/raid0/developer/ext/je/docs/src.md

# /mnt/raid0/developer/ext/je/src/cli.ts

/**
 * CLI argument processor for the je tool
 */
import { parse } from "@std/flags";
import { findConfigFile } from "./config.ts";
import { buildEnv } from "./env-builder.ts";

/**
 * Process CLI arguments and execute the appropriate action
 */
export async function processCli(args: string[]): Promise<void> {
  try {
    const parsedArgs = parse(args, {
      string: ["file"],
      boolean: ["development", "staging", "production", "help"],
      default: { development: false, staging: false, production: false, help: false },
      alias: { f: "file", h: "help", d: "development", s: "staging", p: "production" },
    });

    if (parsedArgs.help) {
      showHelp();
      return;
    }

    // Determine which environment to use
    let environment = "development"; // Default
    if (parsedArgs.production) {
      environment = "production";
    } else if (parsedArgs.staging) {
      environment = "staging";
    }

    // Find and load the config file
    const configPath = parsedArgs.file || await findConfigFile();
    
    // Build the environment variables
    const envContent = await buildEnv(configPath, environment);
    
    // Output to stdout
    console.log(envContent);
  } catch (error) {
    console.error(`Error: ${error.message}`);
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


---

# /mnt/raid0/developer/ext/je/src/config.ts

/**
 * Configuration file handler for the je tool
 */
import { parse as parseJsonc } from "@std/jsonc";
import { exists } from "@std/fs";
import { join } from "@std/path";
import { findGitRoot } from "./git.ts";

/**
 * Find the config file in the git root directory
 * @returns The path to the config file
 */
export async function findConfigFile(): Promise<string> {
  try {
    const gitRoot = await findGitRoot();
    const defaultConfig = join(gitRoot, ".je.jsonc");
    
    if (await exists(defaultConfig)) {
      return defaultConfig;
    }
    
    throw new Error("Could not find .je.jsonc config file in git root directory");
  } catch (error) {
    throw new Error(`Failed to locate config file: ${error.message}`);
  }
}

/**
 * Interface for the environment configuration file structure
 */
export interface EnvConfig {
  base?: Record<string, string>;
  development?: Record<string, string>;
  staging?: Record<string, string>;
  production?: Record<string, string>;
  [key: string]: Record<string, string> | undefined;
}

/**
 * Load and parse the JSONC config file
 * @param configPath Path to the config file
 * @returns Parsed config object
 */
export async function loadConfig(configPath: string): Promise<EnvConfig> {
  try {
    const content = await Deno.readTextFile(configPath);
    return parseJsonc(content) as EnvConfig;
  } catch (error) {
    throw new Error(`Failed to load or parse config file: ${error.message}`);
  }
}


---

# /mnt/raid0/developer/ext/je/src/env-builder.ts

/**
 * Environment file builder for the je tool
 */
import { loadConfig, EnvConfig } from "./config.ts";

/**
 * Build the environment file content by merging base and environment-specific variables
 * @param configPath Path to the config file
 * @param environment Environment to build (development, staging, production)
 * @returns Formatted .env file content
 */
export async function buildEnv(configPath: string, environment: string): Promise<string> {
  const config = await loadConfig(configPath);
  
  // Validate the config has the necessary sections
  if (!config.base) {
    throw new Error("Config file must contain a 'base' section");
  }
  
  if (!config[environment]) {
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
  if (/[\s"'\\$&#]/.test(value)) {
    // Escape quotes and backslashes
    const escaped = value.replace(/["\\]/g, "\\$&");
    return `"${escaped}"`;
  }
  return value;
}


---

# /mnt/raid0/developer/ext/je/src/git.ts

/**
 * Git repository utilities for the je tool
 */
import { join, dirname } from "@std/path";
import { exists } from "@std/fs";

/**
 * Find the root directory of the current git repository
 * @param startDir Directory to start the search from (defaults to current directory)
 * @returns The absolute path to the git repository root
 */
export async function findGitRoot(startDir: string = Deno.cwd()): Promise<string> {
  let currentDir = startDir;
  
  while (true) {
    const gitDir = join(currentDir, ".git");
    if (await exists(gitDir)) {
      return currentDir;
    }
    
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error("Could not find git repository root");
    }
    
    currentDir = parentDir;
  }
}


---

# /mnt/raid0/developer/ext/je/tests/env-builder.test.ts

import { assertEquals, assertRejects } from "@std/assert";
import { buildEnv } from "../src/env-builder.ts";
import { join } from "@std/path";

const testDir = join(Deno.cwd(), "tests");
const testConfigPath = join(testDir, "fixtures", "test-config.jsonc");

Deno.test({
  name: "Env Builder Tests",
  fn: async (t) => {
    await t.step("should build development environment", async () => {
      const env = await buildEnv(testConfigPath, "development");
      
      assertEquals(env.includes("NODE_ENV=development"), true);
      assertEquals(env.includes("APP_NAME=je-test-app"), true);
      assertEquals(env.includes("DEBUG=true"), true);
      assertEquals(env.includes('COMPLEX_VALUE="value with spaces"'), true);
      assertEquals(env.includes("API_URL=http://localhost:3000"), true);
      assertEquals(env.includes("APP_ENV=development"), true);
    });
    
    await t.step("should build production environment", async () => {
      const env = await buildEnv(testConfigPath, "production");
      
      assertEquals(env.includes("NODE_ENV=production"), true);
      assertEquals(env.includes("APP_NAME=je-test-app"), true);
      assertEquals(env.includes("DEBUG=false"), true);
      assertEquals(env.includes('COMPLEX_VALUE="value with spaces"'), true);
      assertEquals(env.includes("API_URL=https://api.example.com"), true);
      assertEquals(env.includes("APP_ENV=production"), true);
    });
    
    await t.step("should throw error for missing environment", async () => {
      await assertRejects(
        () => buildEnv(testConfigPath, "nonexistent"),
        Error,
        "Config file does not contain a 'nonexistent' section"
      );
    });
  },
});


---

# /mnt/raid0/developer/ext/je/docs/context.md

# Project Context

## Project Overview
`je` (JSON Environment) is a CLI tool that builds `.env` files from JSONC configuration files.

## Key Features
- Uses JSONC (JSON with Comments) for configuration
- Combines base environment variables with environment-specific ones
- Supports development, staging, and production environments
- Automatically finds the git repository root
- Written in TypeScript for Deno with JSR packages only

## Core Concepts
1. **Config File Format**: A JSONC file with `base` section and environment-specific sections
2. **Environment Merging**: Base variables are combined with environment-specific ones
3. **Git Integration**: Automatically locates the git root to find config files

## Architecture
- **CLI Module**: Handles command-line arguments and flags
- **Config Module**: Finds and parses JSONC configuration
- **Git Module**: Locates git repository root
- **Environment Builder**: Merges and formats environment variables

## Technical Decisions
- Using only JSR imports (no HTTPS imports)
- Using JSONC format to allow comments in configuration
- CLI tool outputs to stdout for maximum flexibility
- Default config file location is `.je.jsonc` in git root directory

## Development Status
- Initial implementation

## Future Considerations
- Potential support for additional output formats
- Potential support for environment variable validation


---

# /mnt/raid0/developer/ext/je/docs/getting-started.md

# Getting Started with je

This guide will help you get started with the `je` (JSON Environment) CLI tool.

## Installation

### Prerequisites
- Deno runtime (version 1.x or higher)
- Git (required for automatic config file detection)

### Install via Deno

```bash
# Install directly from source
deno install -A -n je https://raw.githubusercontent.com/<username>/je/main/mod.ts
```

### Manual Installation

```bash
# Clone the repository
git clone <repository-url>
cd je

# Build the binary
deno task build

# Add to your PATH or create a symlink
ln -s "$(pwd)/je" /usr/local/bin/je  # On macOS/Linux
```

## Creating Your First Configuration File

1. Create a `.je.jsonc` file in your project's git root directory:

```jsonc
{
  // Base configuration for all environments
  "base": {
    "NODE_ENV": "development",
    "APP_NAME": "my-first-app",
    "DEBUG": "true",
    "PORT": "3000"
  },
  
  // Development specific overrides
  "development": {
    "API_URL": "http://localhost:3000",
    "DATABASE_URL": "postgres://user:pass@localhost:5432/mydb"
  },
  
  // Staging specific overrides
  "staging": {
    "NODE_ENV": "staging",
    "API_URL": "https://staging-api.example.com",
    "DATABASE_URL": "postgres://user:pass@staging-db:5432/mydb"
  },
  
  // Production specific overrides
  "production": {
    "NODE_ENV": "production",
    "DEBUG": "false",
    "API_URL": "https://api.example.com",
    "DATABASE_URL": "postgres://user:pass@prod-db:5432/mydb"
  }
}
```

## Basic Usage

### Generate Environment Files

```bash
# Generate development environment (default)
je > .env.development

# Generate production environment
je --production > .env.production

# Generate staging environment
je --staging > .env.staging
```

### Using a Custom Config File

```bash
# Specify a custom config file path
je --file=/path/to/my-config.jsonc --production > .env
```

## Advanced Usage

### Integration with Docker

You can use `je` to generate environment files for Docker containers:

```bash
# Generate environment file for Docker Compose
je --production > .env

# Or pipe directly into Docker run
docker run --env-file <(je --production) my-image
```

### Integration with Build Scripts

Add to your package.json:

```json
{
  "scripts": {
    "prebuild": "je --production > .env.production",
    "build": "..."
  }
}
```

### Shell Integration

Add to your shell profile:

```bash
# Add this to your .bashrc or .zshrc
loadenv() {
  export $(je "$@" | xargs)
}

# Usage: 
# loadenv --production
```

## Troubleshooting

### Error: "Could not find git repository root"

Make sure you're running `je` within a git repository. If you need to use it outside a git repository, specify the config file path explicitly:

```bash
je --file=/absolute/path/to/config.jsonc
```

### Error: "Could not find .je.jsonc config file in git root directory"

Create a `.je.jsonc` file in your git repository root, or specify a custom config file path with the `--file` option.


---

# /mnt/raid0/developer/ext/je/docs/implementation.md

# Implementation Details

## Architecture

The `je` CLI tool is designed with a modular architecture consisting of the following components:

### 1. CLI Module (`src/cli.ts`)
- Entry point for processing command-line arguments
- Uses `@std/flags` to parse command-line flags
- Dispatches to appropriate functions based on arguments
- Handles error reporting and help display

### 2. Config Module (`src/config.ts`)
- Responsible for finding and loading the configuration file
- Parses JSONC content using `@std/jsonc`
- Defines the configuration file structure interface
- Handles validation of required configuration sections

### 3. Git Module (`src/git.ts`)
- Utility for finding the git repository root
- Recursively searches parent directories for a `.git` directory
- Provides functionality for locating default config file

### 4. Environment Builder (`src/env-builder.ts`)
- Core logic for merging environment variables
- Combines base variables with environment-specific ones
- Handles escaping of special characters in env values
- Formats output according to .env file conventions

## Data Flow

1. User invokes CLI with arguments
2. CLI module parses arguments and determines the target environment
3. Config module locates and loads the configuration file
4. Environment builder merges base and environment-specific variables
5. Formatted environment file content is output to stdout

## Config File Format

The configuration file uses JSONC format to allow comments, with the following structure:

```jsonc
{
  // Base environment variables (required)
  "base": {
    "KEY1": "value1",
    "KEY2": "value2"
  },
  
  // Environment-specific overrides
  "development": {
    "KEY1": "override-value1"
  },
  
  "staging": {
    // ...
  },
  
  "production": {
    // ...
  }
}
```

## Value Escaping

Environment variable values are automatically escaped according to the following rules:

- Values with spaces, newlines, or special characters are wrapped in double quotes
- Double quotes and backslashes within values are escaped with a backslash
- Simple values without special characters are left as-is

## Error Handling

The tool provides clear error messages for common issues:
- Missing configuration file
- Invalid JSONC syntax
- Missing required sections in configuration
- Non-existent environment specified

## Future Enhancements

1. Variable interpolation (`${VAR}` syntax)
2. Environment variable validation
3. Support for complex data structures (lists, nested objects)
4. Secret management integration


---

# /mnt/raid0/developer/ext/je/docs/src.md

# /mnt/raid0/developer/ext/je/src/cli.ts

/**
 * CLI argument processor for the je tool
 */
import { parse } from "@std/flags";
import { findConfigFile } from "./config.ts";
import { buildEnv } from "./env-builder.ts";

/**
 * Process CLI arguments and execute the appropriate action
 */
export async function processCli(args: string[]): Promise<void> {
  try {
    const parsedArgs = parse(args, {
      string: ["file"],
      boolean: ["development", "staging", "production", "help"],
      default: { development: false, staging: false, production: false, help: false },
      alias: { f: "file", h: "help", d: "development", s: "staging", p: "production" },
    });

    if (parsedArgs.help) {
      showHelp();
      return;
    }

    // Determine which environment to use
    let environment = "development"; // Default
    if (parsedArgs.production) {
      environment = "production";
    } else if (parsedArgs.staging) {
      environment = "staging";
    }

    // Find and load the config file
    const configPath = parsedArgs.file || await findConfigFile();
    
    // Build the environment variables
    const envContent = await buildEnv(configPath, environment);
    
    // Output to stdout
    console.log(envContent);
  } catch (error) {
    console.error(`Error: ${error.message}`);
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


---

# /mnt/raid0/developer/ext/je/src/config.ts

/**
 * Configuration file handler for the je tool
 */
import { parse as parseJsonc } from "@std/jsonc";
import { exists } from "@std/fs";
import { join } from "@std/path";
import { findGitRoot } from "./git.ts";

/**
 * Find the config file in the git root directory
 * @returns The path to the config file
 */
export async function findConfigFile(): Promise<string> {
  try {
    const gitRoot = await findGitRoot();
    const defaultConfig = join(gitRoot, ".je.jsonc");
    
    if (await exists(defaultConfig)) {
      return defaultConfig;
    }
    
    throw new Error("Could not find .je.jsonc config file in git root directory");
  } catch (error) {
    throw new Error(`Failed to locate config file: ${error.message}`);
  }
}

/**
 * Interface for the environment configuration file structure
 */
export interface EnvConfig {
  base?: Record<string, string>;
  development?: Record<string, string>;
  staging?: Record<string, string>;
  production?: Record<string, string>;
  [key: string]: Record<string, string> | undefined;
}

/**
 * Load and parse the JSONC config file
 * @param configPath Path to the config file
 * @returns Parsed config object
 */
export async function loadConfig(configPath: string): Promise<EnvConfig> {
  try {
    const content = await Deno.readTextFile(configPath);
    return parseJsonc(content) as EnvConfig;
  } catch (error) {
    throw new Error(`Failed to load or parse config file: ${error.message}`);
  }
}


---

# /mnt/raid0/developer/ext/je/src/env-builder.ts

/**
 * Environment file builder for the je tool
 */
import { loadConfig, EnvConfig } from "./config.ts";

/**
 * Build the environment file content by merging base and environment-specific variables
 * @param configPath Path to the config file
 * @param environment Environment to build (development, staging, production)
 * @returns Formatted .env file content
 */
export async function buildEnv(configPath: string, environment: string): Promise<string> {
  const config = await loadConfig(configPath);
  
  // Validate the config has the necessary sections
  if (!config.base) {
    throw new Error("Config file must contain a 'base' section");
  }
  
  if (!config[environment]) {
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
  if (/[\s"'\\$&#]/.test(value)) {
    // Escape quotes and backslashes
    const escaped = value.replace(/["\\]/g, "\\$&");
    return `"${escaped}"`;
  }
  return value;
}


---

# /mnt/raid0/developer/ext/je/src/git.ts

/**
 * Git repository utilities for the je tool
 */
import { join, dirname } from "@std/path";
import { exists } from "@std/fs";

/**
 * Find the root directory of the current git repository
 * @param startDir Directory to start the search from (defaults to current directory)
 * @returns The absolute path to the git repository root
 */
export async function findGitRoot(startDir: string = Deno.cwd()): Promise<string> {
  let currentDir = startDir;
  
  while (true) {
    const gitDir = join(currentDir, ".git");
    if (await exists(gitDir)) {
      return currentDir;
    }
    
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error("Could not find git repository root");
    }
    
    currentDir = parentDir;
  }
}


---

# /mnt/raid0/developer/ext/je/docs/context.md

# Project Context

## Project Overview
`je` (JSON Environment) is a CLI tool that builds `.env` files from JSONC configuration files.

## Key Features
- Uses JSONC (JSON with Comments) for configuration
- Combines base environment variables with environment-specific ones
- Supports development, staging, and production environments
- Automatically finds the git repository root
- Written in TypeScript for Deno with JSR packages only

## Core Concepts
1. **Config File Format**: A JSONC file with `base` section and environment-specific sections
2. **Environment Merging**: Base variables are combined with environment-specific ones
3. **Git Integration**: Automatically locates the git root to find config files

## Architecture
- **CLI Module**: Handles command-line arguments and flags
- **Config Module**: Finds and parses JSONC configuration
- **Git Module**: Locates git repository root
- **Environment Builder**: Merges and formats environment variables

## Technical Decisions
- Using only JSR imports (no HTTPS imports)
- Using JSONC format to allow comments in configuration
- CLI tool outputs to stdout for maximum flexibility
- Default config file location is `.je.jsonc` in git root directory

## Development Status
- Initial implementation

## Future Considerations
- Potential support for additional output formats
- Potential support for environment variable validation


---

# /mnt/raid0/developer/ext/je/docs/getting-started.md

# Getting Started with je

This guide will help you get started with the `je` (JSON Environment) CLI tool.

## Installation

### Prerequisites
- Deno runtime (version 1.x or higher)
- Git (required for automatic config file detection)

### Install via Deno

```bash
# Install directly from source
deno install -A -n je https://raw.githubusercontent.com/<username>/je/main/mod.ts
```

### Manual Installation

```bash
# Clone the repository
git clone <repository-url>
cd je

# Build the binary
deno task build

# Add to your PATH or create a symlink
ln -s "$(pwd)/je" /usr/local/bin/je  # On macOS/Linux
```

## Creating Your First Configuration File

1. Create a `.je.jsonc` file in your project's git root directory:

```jsonc
{
  // Base configuration for all environments
  "base": {
    "NODE_ENV": "development",
    "APP_NAME": "my-first-app",
    "DEBUG": "true",
    "PORT": "3000"
  },
  
  // Development specific overrides
  "development": {
    "API_URL": "http://localhost:3000",
    "DATABASE_URL": "postgres://user:pass@localhost:5432/mydb"
  },
  
  // Staging specific overrides
  "staging": {
    "NODE_ENV": "staging",
    "API_URL": "https://staging-api.example.com",
    "DATABASE_URL": "postgres://user:pass@staging-db:5432/mydb"
  },
  
  // Production specific overrides
  "production": {
    "NODE_ENV": "production",
    "DEBUG": "false",
    "API_URL": "https://api.example.com",
    "DATABASE_URL": "postgres://user:pass@prod-db:5432/mydb"
  }
}
```

## Basic Usage

### Generate Environment Files

```bash
# Generate development environment (default)
je > .env.development

# Generate production environment
je --production > .env.production

# Generate staging environment
je --staging > .env.staging
```

### Using a Custom Config File

```bash
# Specify a custom config file path
je --file=/path/to/my-config.jsonc --production > .env
```

## Advanced Usage

### Integration with Docker

You can use `je` to generate environment files for Docker containers:

```bash
# Generate environment file for Docker Compose
je --production > .env

# Or pipe directly into Docker run
docker run --env-file <(je --production) my-image
```

### Integration with Build Scripts

Add to your package.json:

```json
{
  "scripts": {
    "prebuild": "je --production > .env.production",
    "build": "..."
  }
}
```

### Shell Integration

Add to your shell profile:

```bash
# Add this to your .bashrc or .zshrc
loadenv() {
  export $(je "$@" | xargs)
}

# Usage: 
# loadenv --production
```

## Troubleshooting

### Error: "Could not find git repository root"

Make sure you're running `je` within a git repository. If you need to use it outside a git repository, specify the config file path explicitly:

```bash
je --file=/absolute/path/to/config.jsonc
```

### Error: "Could not find .je.jsonc config file in git root directory"

Create a `.je.jsonc` file in your git repository root, or specify a custom config file path with the `--file` option.


---

# /mnt/raid0/developer/ext/je/docs/implementation.md

# Implementation Details

## Architecture

The `je` CLI tool is designed with a modular architecture consisting of the following components:

### 1. CLI Module (`src/cli.ts`)
- Entry point for processing command-line arguments
- Uses `@std/flags` to parse command-line flags
- Dispatches to appropriate functions based on arguments
- Handles error reporting and help display

### 2. Config Module (`src/config.ts`)
- Responsible for finding and loading the configuration file
- Parses JSONC content using `@std/jsonc`
- Defines the configuration file structure interface
- Handles validation of required configuration sections

### 3. Git Module (`src/git.ts`)
- Utility for finding the git repository root
- Recursively searches parent directories for a `.git` directory
- Provides functionality for locating default config file

### 4. Environment Builder (`src/env-builder.ts`)
- Core logic for merging environment variables
- Combines base variables with environment-specific ones
- Handles escaping of special characters in env values
- Formats output according to .env file conventions

## Data Flow

1. User invokes CLI with arguments
2. CLI module parses arguments and determines the target environment
3. Config module locates and loads the configuration file
4. Environment builder merges base and environment-specific variables
5. Formatted environment file content is output to stdout

## Config File Format

The configuration file uses JSONC format to allow comments, with the following structure:

```jsonc
{
  // Base environment variables (required)
  "base": {
    "KEY1": "value1",
    "KEY2": "value2"
  },
  
  // Environment-specific overrides
  "development": {
    "KEY1": "override-value1"
  },
  
  "staging": {
    // ...
  },
  
  "production": {
    // ...
  }
}
```

## Value Escaping

Environment variable values are automatically escaped according to the following rules:

- Values with spaces, newlines, or special characters are wrapped in double quotes
- Double quotes and backslashes within values are escaped with a backslash
- Simple values without special characters are left as-is

## Error Handling

The tool provides clear error messages for common issues:
- Missing configuration file
- Invalid JSONC syntax
- Missing required sections in configuration
- Non-existent environment specified

## Future Enhancements

1. Variable interpolation (`${VAR}` syntax)
2. Environment variable validation
3. Support for complex data structures (lists, nested objects)
4. Secret management integration


---

# /mnt/raid0/developer/ext/je/docs/todo.md

# Development TODO List

## High Priority
- [x] Create initial project structure
- [ ] Implement core functionality:
  - [ ] CLI argument processing
  - [ ] Configuration file loading (JSONC)
  - [ ] Git root directory detection
  - [ ] Environment variable merging and formatting
- [ ] Write unit tests for all core modules
- [ ] Implement binary build process
- [ ] Create comprehensive README with usage examples

## Medium Priority
- [ ] Add support for variable interpolation (`${VAR}` syntax)
- [ ] Add validation for environment variable format
- [ ] Implement verbose mode for debugging
- [ ] Add support for environment variable schema validation
- [ ] Create examples directory with sample configurations

## Low Priority
- [ ] Add support for output to multiple files
- [ ] Implement watch mode to regenerate env files on config changes
- [ ] Add support for environment variable encryption/decryption
- [ ] Create GitHub Actions workflow for testing and releases
- [ ] Add support for additional output formats (JSON, YAML)

## Bugs and Issues
- None identified yet


---

# /mnt/raid0/developer/ext/je/mod.ts

#!/usr/bin/env -S deno run -A
/**
 * je - JSON Environment Builder CLI
 * 
 * A CLI tool that builds environment files (.env) from a JSONC configuration file,
 * combining base variables with environment-specific ones.
 */

import { processCli } from "./src/cli.ts";

if (import.meta.main) {
  processCli(Deno.args);
}


---

# /mnt/raid0/developer/ext/je/README.md

# je - JSON Environment Builder

A simple CLI tool that builds environment files (.env) from a JSONC configuration file, combining base variables with environment-specific ones.

## Features

- Uses JSONC (JSON with Comments) for configuration
- Combines base environment variables with environment-specific variables
- Supports development, staging, and production environments
- Automatically finds the git repository root
- Written in TypeScript for Deno with JSR packages only

## Installation

### From Source

```bash
# Clone the repository
git clone <repository-url>
cd je

# Build the binary
deno task build

# Add to your PATH or create a symlink
ln -s "$(pwd)/je" /usr/local/bin/je  # On macOS/Linux
```

### Via Deno

```bash
# Run directly with Deno
deno run -A https://raw.githubusercontent.com/<username>/je/main/mod.ts --help

# Install globally with Deno
deno install -A -n je https://raw.githubusercontent.com/<username>/je/main/mod.ts
```

## Usage

```bash
# Build .env file for development (default)
je

# Build .env file for production
je --production

# Build .env file for staging
je --staging

# Use a custom config file
je --file=config/my-config.jsonc --production

# Redirect output to a .env file
je --production > .env
```

## Configuration File Format

Create a `.je.jsonc` file in your project's git root directory:

```jsonc
{
  // Base configuration for all environments
  "base": {
    "NODE_ENV": "development",
    "APP_NAME": "my-app",
    "DEBUG": "true"
  },
  
  // Development specific overrides
  "development": {
    "API_URL": "http://localhost:3000",
    "DB_HOST": "localhost"
  },
  
  // Staging specific overrides
  "staging": {
    "NODE_ENV": "staging",
    "API_URL": "https://staging-api.example.com",
    "DEBUG": "true"
  },
  
  // Production specific overrides
  "production": {
    "NODE_ENV": "production",
    "API_URL": "https://api.example.com",
    "DEBUG": "false"
  }
}
```

The CLI will:
1. Load the base variables
2. Apply environment-specific variables (overriding any base variables with the same name)
3. Output the combined result

## Development

```bash
# Run the CLI in development mode
deno task start

# Run tests
deno task test

# Build the binary
deno task build
```

## Documentation

- See `docs/context.md` for project context and architecture
- See `docs/todo.md` for current development status and roadmap

## License

MIT



---

# /mnt/raid0/developer/ext/je/docs/todo.md

# Development TODO List

## High Priority
- [x] Create initial project structure
- [ ] Implement core functionality:
  - [ ] CLI argument processing
  - [ ] Configuration file loading (JSONC)
  - [ ] Git root directory detection
  - [ ] Environment variable merging and formatting
- [ ] Write unit tests for all core modules
- [ ] Implement binary build process
- [ ] Create comprehensive README with usage examples

## Medium Priority
- [ ] Add support for variable interpolation (`${VAR}` syntax)
- [ ] Add validation for environment variable format
- [ ] Implement verbose mode for debugging
- [ ] Add support for environment variable schema validation
- [ ] Create examples directory with sample configurations

## Low Priority
- [ ] Add support for output to multiple files
- [ ] Implement watch mode to regenerate env files on config changes
- [ ] Add support for environment variable encryption/decryption
- [ ] Create GitHub Actions workflow for testing and releases
- [ ] Add support for additional output formats (JSON, YAML)

## Bugs and Issues
- None identified yet


---

# /mnt/raid0/developer/ext/je/deno.json

{
  "name": "je",
  "version": "1.0.0",
  "description": "JSON Environment Builder CLI",
  "imports": {
    "@std/path": "jsr:@std/path@^0.218.2",
    "@std/fs": "jsr:@std/fs@^0.218.2",
    "@std/flags": "jsr:@std/flags@^0.218.2",
    "@std/jsonc": "jsr:@std/jsonc@^0.218.2",
    "@std/assert": "jsr:@std/assert@^0.218.2"
  },
  "tasks": {
    "start": "deno run -A mod.ts",
    "test": "deno test -A",
    "build": "deno compile -A --output je mod.ts"
  },
  "fmt": {
    "indentWidth": 2,
    "lineWidth": 100,
    "semiColons": true
  }
}

---

# /mnt/raid0/developer/ext/je/mod.ts

#!/usr/bin/env -S deno run -A
/**
 * je - JSON Environment Builder CLI
 * 
 * A CLI tool that builds environment files (.env) from a JSONC configuration file,
 * combining base variables with environment-specific ones.
 */

import { processCli } from "./src/cli.ts";

if (import.meta.main) {
  processCli(Deno.args);
}


---

# /mnt/raid0/developer/ext/je/README.md

# je - JSON Environment Builder

A simple CLI tool that builds environment files (.env) from a JSONC configuration file, combining base variables with environment-specific ones.

## Features

- Uses JSONC (JSON with Comments) for configuration
- Combines base environment variables with environment-specific variables
- Supports development, staging, and production environments
- Automatically finds the git repository root
- Written in TypeScript for Deno with JSR packages only

## Installation

### From Source

```bash
# Clone the repository
git clone <repository-url>
cd je

# Build the binary
deno task build

# Add to your PATH or create a symlink
ln -s "$(pwd)/je" /usr/local/bin/je  # On macOS/Linux
```

### Via Deno

```bash
# Run directly with Deno
deno run -A https://raw.githubusercontent.com/<username>/je/main/mod.ts --help

# Install globally with Deno
deno install -A -n je https://raw.githubusercontent.com/<username>/je/main/mod.ts
```

## Usage

```bash
# Build .env file for development (default)
je

# Build .env file for production
je --production

# Build .env file for staging
je --staging

# Use a custom config file
je --file=config/my-config.jsonc --production

# Redirect output to a .env file
je --production > .env
```

## Configuration File Format

Create a `.je.jsonc` file in your project's git root directory:

```jsonc
{
  // Base configuration for all environments
  "base": {
    "NODE_ENV": "development",
    "APP_NAME": "my-app",
    "DEBUG": "true"
  },
  
  // Development specific overrides
  "development": {
    "API_URL": "http://localhost:3000",
    "DB_HOST": "localhost"
  },
  
  // Staging specific overrides
  "staging": {
    "NODE_ENV": "staging",
    "API_URL": "https://staging-api.example.com",
    "DEBUG": "true"
  },
  
  // Production specific overrides
  "production": {
    "NODE_ENV": "production",
    "API_URL": "https://api.example.com",
    "DEBUG": "false"
  }
}
```

The CLI will:
1. Load the base variables
2. Apply environment-specific variables (overriding any base variables with the same name)
3. Output the combined result

## Development

```bash
# Run the CLI in development mode
deno task start

# Run tests
deno task test

# Build the binary
deno task build
```

## Documentation

- See `docs/context.md` for project context and architecture
- See `docs/todo.md` for current development status and roadmap

## License

MIT



---

# /mnt/raid0/developer/ext/je/docs/todo.md

# Development TODO List

## High Priority
- [x] Create initial project structure
- [ ] Implement core functionality:
  - [ ] CLI argument processing
  - [ ] Configuration file loading (JSONC)
  - [ ] Git root directory detection
  - [ ] Environment variable merging and formatting
- [ ] Write unit tests for all core modules
- [ ] Implement binary build process
- [ ] Create comprehensive README with usage examples

## Medium Priority
- [ ] Add support for variable interpolation (`${VAR}` syntax)
- [ ] Add validation for environment variable format
- [ ] Implement verbose mode for debugging
- [ ] Add support for environment variable schema validation
- [ ] Create examples directory with sample configurations

## Low Priority
- [ ] Add support for output to multiple files
- [ ] Implement watch mode to regenerate env files on config changes
- [ ] Add support for environment variable encryption/decryption
- [ ] Create GitHub Actions workflow for testing and releases
- [ ] Add support for additional output formats (JSON, YAML)

## Bugs and Issues
- None identified yet


---

# /mnt/raid0/developer/ext/je/deno.json

{
  "name": "je",
  "version": "1.0.0",
  "description": "JSON Environment Builder CLI",
  "imports": {
    "@std/path": "jsr:@std/path@^0.218.2",
    "@std/fs": "jsr:@std/fs@^0.218.2",
    "@std/flags": "jsr:@std/flags@^0.218.2",
    "@std/jsonc": "jsr:@std/jsonc@^0.218.2",
    "@std/assert": "jsr:@std/assert@^0.218.2"
  },
  "tasks": {
    "start": "deno run -A mod.ts",
    "test": "deno test -A",
    "build": "deno compile -A --output je mod.ts"
  },
  "fmt": {
    "indentWidth": 2,
    "lineWidth": 100,
    "semiColons": true
  }
}

---

# /mnt/raid0/developer/ext/je/mod.ts

#!/usr/bin/env -S deno run -A
/**
 * je - JSON Environment Builder CLI
 * 
 * A CLI tool that builds environment files (.env) from a JSONC configuration file,
 * combining base variables with environment-specific ones.
 */

import { processCli } from "./src/cli.ts";

if (import.meta.main) {
  processCli(Deno.args);
}


---

# /mnt/raid0/developer/ext/je/README.md

# je - JSON Environment Builder

A simple CLI tool that builds environment files (.env) from a JSONC configuration file, combining base variables with environment-specific ones.

## Features

- Uses JSONC (JSON with Comments) for configuration
- Combines base environment variables with environment-specific variables
- Supports development, staging, and production environments
- Automatically finds the git repository root
- Written in TypeScript for Deno with JSR packages only

## Installation

### From Source

```bash
# Clone the repository
git clone <repository-url>
cd je

# Build the binary
deno task build

# Add to your PATH or create a symlink
ln -s "$(pwd)/je" /usr/local/bin/je  # On macOS/Linux
```

### Via Deno

```bash
# Run directly with Deno
deno run -A https://raw.githubusercontent.com/<username>/je/main/mod.ts --help

# Install globally with Deno
deno install -A -n je https://raw.githubusercontent.com/<username>/je/main/mod.ts
```

## Usage

```bash
# Build .env file for development (default)
je

# Build .env file for production
je --production

# Build .env file for staging
je --staging

# Use a custom config file
je --file=config/my-config.jsonc --production

# Redirect output to a .env file
je --production > .env
```

## Configuration File Format

Create a `.je.jsonc` file in your project's git root directory:

```jsonc
{
  // Base configuration for all environments
  "base": {
    "NODE_ENV": "development",
    "APP_NAME": "my-app",
    "DEBUG": "true"
  },
  
  // Development specific overrides
  "development": {
    "API_URL": "http://localhost:3000",
    "DB_HOST": "localhost"
  },
  
  // Staging specific overrides
  "staging": {
    "NODE_ENV": "staging",
    "API_URL": "https://staging-api.example.com",
    "DEBUG": "true"
  },
  
  // Production specific overrides
  "production": {
    "NODE_ENV": "production",
    "API_URL": "https://api.example.com",
    "DEBUG": "false"
  }
}
```

The CLI will:
1. Load the base variables
2. Apply environment-specific variables (overriding any base variables with the same name)
3. Output the combined result

## Development

```bash
# Run the CLI in development mode
deno task start

# Run tests
deno task test

# Build the binary
deno task build
```

## Documentation

- See `docs/context.md` for project context and architecture
- See `docs/todo.md` for current development status and roadmap

## License

MIT



---

# /mnt/raid0/developer/ext/je/docs/todo.md

# Development TODO List

## High Priority
- [x] Create initial project structure
- [ ] Implement core functionality:
  - [ ] CLI argument processing
  - [ ] Configuration file loading (JSONC)
  - [ ] Git root directory detection
  - [ ] Environment variable merging and formatting
- [ ] Write unit tests for all core modules
- [ ] Implement binary build process
- [ ] Create comprehensive README with usage examples

## Medium Priority
- [ ] Add support for variable interpolation (`${VAR}` syntax)
- [ ] Add validation for environment variable format
- [ ] Implement verbose mode for debugging
- [ ] Add support for environment variable schema validation
- [ ] Create examples directory with sample configurations

## Low Priority
- [ ] Add support for output to multiple files
- [ ] Implement watch mode to regenerate env files on config changes
- [ ] Add support for environment variable encryption/decryption
- [ ] Create GitHub Actions workflow for testing and releases
- [ ] Add support for additional output formats (JSON, YAML)

## Bugs and Issues
- None identified yet


---

# /mnt/raid0/developer/ext/je/deno.json

{
  "name": "je",
  "version": "1.0.0",
  "description": "JSON Environment Builder CLI",
  "imports": {
    "@std/path": "jsr:@std/path@^0.218.2",
    "@std/fs": "jsr:@std/fs@^0.218.2",
    "@std/flags": "jsr:@std/flags@^0.218.2",
    "@std/jsonc": "jsr:@std/jsonc@^0.218.2",
    "@std/assert": "jsr:@std/assert@^0.218.2"
  },
  "tasks": {
    "start": "deno run -A mod.ts",
    "test": "deno test -A",
    "build": "deno compile -A --output je mod.ts"
  },
  "fmt": {
    "indentWidth": 2,
    "lineWidth": 100,
    "semiColons": true
  }
}

---

# /mnt/raid0/developer/ext/je/mod.ts

#!/usr/bin/env -S deno run -A
/**
 * je - JSON Environment Builder CLI
 * 
 * A CLI tool that builds environment files (.env) from a JSONC configuration file,
 * combining base variables with environment-specific ones.
 */

import { processCli } from "./src/cli.ts";

if (import.meta.main) {
  processCli(Deno.args);
}


---

# /mnt/raid0/developer/ext/je/README.md

# je - JSON Environment Builder

A simple CLI tool that builds environment files (.env) from a JSONC configuration file, combining base variables with environment-specific ones.

## Features

- Uses JSONC (JSON with Comments) for configuration
- Combines base environment variables with environment-specific variables
- Supports development, staging, and production environments
- Automatically finds the git repository root
- Written in TypeScript for Deno with JSR packages only

## Installation

### From Source

```bash
# Clone the repository
git clone <repository-url>
cd je

# Build the binary
deno task build

# Add to your PATH or create a symlink
ln -s "$(pwd)/je" /usr/local/bin/je  # On macOS/Linux
```

### Via Deno

```bash
# Run directly with Deno
deno run -A https://raw.githubusercontent.com/<username>/je/main/mod.ts --help

# Install globally with Deno
deno install -A -n je https://raw.githubusercontent.com/<username>/je/main/mod.ts
```

## Usage

```bash
# Build .env file for development (default)
je

# Build .env file for production
je --production

# Build .env file for staging
je --staging

# Use a custom config file
je --file=config/my-config.jsonc --production

# Redirect output to a .env file
je --production > .env
```

## Configuration File Format

Create a `.je.jsonc` file in your project's git root directory:

```jsonc
{
  // Base configuration for all environments
  "base": {
    "NODE_ENV": "development",
    "APP_NAME": "my-app",
    "DEBUG": "true"
  },
  
  // Development specific overrides
  "development": {
    "API_URL": "http://localhost:3000",
    "DB_HOST": "localhost"
  },
  
  // Staging specific overrides
  "staging": {
    "NODE_ENV": "staging",
    "API_URL": "https://staging-api.example.com",
    "DEBUG": "true"
  },
  
  // Production specific overrides
  "production": {
    "NODE_ENV": "production",
    "API_URL": "https://api.example.com",
    "DEBUG": "false"
  }
}
```

The CLI will:
1. Load the base variables
2. Apply environment-specific variables (overriding any base variables with the same name)
3. Output the combined result

## Development

```bash
# Run the CLI in development mode
deno task start

# Run tests
deno task test

# Build the binary
deno task build
```

## Documentation

- See `docs/context.md` for project context and architecture
- See `docs/todo.md` for current development status and roadmap

## License

MIT

