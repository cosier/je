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
