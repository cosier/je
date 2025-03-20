# je - JSON Environment Builder

A simple CLI tool that builds environment files (.env) from a JSONC configuration file, combining base variables with environment-specific ones.

## Features

- Uses JSONC (JSON with Comments) for configuration
- Combines base environment variables with environment-specific variables
- Supports development, staging, and production environments
- Automatically finds the git repository root
- Written in TypeScript for Deno with JSR packages only

## Running from GitHub

When running directly from GitHub, you need to use an import map to resolve the JSR dependencies:

```bash
# Run using the import map from GitHub
deno run --import-map=https://raw.githubusercontent.com/cosier/je/master/import-map.json -A https://raw.githubusercontent.com/cosier/je/master/mod.ts --help
```

## Installation

### From Source

```bash
# Clone the repository
git clone <repository-url>
cd je

# Build the binary
deno task build

# Add to your PATH or create a symlink
ln -s "$(pwd)/dist/je" /usr/local/bin/je  # On macOS/Linux
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
