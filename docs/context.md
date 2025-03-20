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
