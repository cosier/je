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
