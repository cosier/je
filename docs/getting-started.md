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
