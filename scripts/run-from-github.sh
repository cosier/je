#!/bin/bash
# This script demonstrates how to run je directly from GitHub

# Run using the import-map.json from GitHub
deno run --import-map=https://raw.githubusercontent.com/cosier/je/master/import-map.json -A https://raw.githubusercontent.com/cosier/je/master/mod.ts "$@"
