import { assertEquals, assertRejects } from "@std/assert";
import { buildEnv } from "../src/env-builder.ts";
import { join } from "@std/path";
import { loadConfig } from "../src/config.ts";

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

    // New tests for counting total entries and checking merging behavior
    await t.step("should have correct number of entries for development environment", async () => {
      const env = await buildEnv(testConfigPath, "development");
      const lines = env.split("\n").filter(line => line.trim() !== "");
      
      // 4 from base + 2 from development = 6 entries
      assertEquals(lines.length, 6, "Development environment should have 6 entries");
    });

    await t.step("should have correct number of entries for production environment", async () => {
      const env = await buildEnv(testConfigPath, "production");
      const lines = env.split("\n").filter(line => line.trim() !== "");
      
      // 4 from base + 3 from production (with 2 overrides) = 6 entries total
      // Because even though NODE_ENV and DEBUG are overridden, they still count as entries
      assertEquals(lines.length, 6, "Production environment should have 6 entries");
    });

    await t.step("should override base values with environment specific values", async () => {
      // Load the raw config for reference
      const config = await loadConfig(testConfigPath);
      
      // Check development environment
      let env = await buildEnv(testConfigPath, "development");
      assertEquals(env.includes("NODE_ENV=development"), true, 
        "NODE_ENV should be 'development' as specified in base section");
      
      // Check production environment for overriding NODE_ENV
      env = await buildEnv(testConfigPath, "production");
      assertEquals(env.includes("NODE_ENV=production"), true, 
        "NODE_ENV should be 'production', overriding the base value");
      assertEquals(env.includes("DEBUG=false"), true, 
        "DEBUG should be 'false', overriding the base value of 'true'");
    });

    await t.step("should properly merge base and environment variables", async () => {
      // Test with development environment
      const devEnv = await buildEnv(testConfigPath, "development");
      const devLines = devEnv.split("\n").filter(line => line.trim() !== "");
      
      // Base variables should be present
      assertEquals(devLines.some(line => line.startsWith("APP_NAME=")), true, 
        "APP_NAME from base should be included");
      assertEquals(devLines.some(line => line.startsWith("COMPLEX_VALUE=")), true, 
        "COMPLEX_VALUE from base should be included");
      
      // Environment-specific variables should be present
      assertEquals(devLines.some(line => line.startsWith("API_URL=")), true, 
        "API_URL from development should be included");
      assertEquals(devLines.some(line => line.startsWith("APP_ENV=")), true, 
        "APP_ENV from development should be included");
    });
    
    await t.step("should handle merging with exact key-value verification", async () => {
      // Test merging with production environment (which has overrides)
      const prodEnv = await buildEnv(testConfigPath, "production");
      
      // Check for specific key-value pairs
      // Original base values
      assertEquals(prodEnv.includes("APP_NAME=je-test-app"), true, 
        "APP_NAME should maintain base value");
      assertEquals(prodEnv.includes('COMPLEX_VALUE="value with spaces"'), true, 
        "COMPLEX_VALUE should maintain base value");
      
      // Overridden values
      assertEquals(prodEnv.includes("NODE_ENV=production"), true, 
        "NODE_ENV should be overridden to production");
      assertEquals(prodEnv.includes("DEBUG=false"), true, 
        "DEBUG should be overridden to false");
      
      // Environment-specific values
      assertEquals(prodEnv.includes("API_URL=https://api.example.com"), true, 
        "API_URL should have production value");
      assertEquals(prodEnv.includes("APP_ENV=production"), true, 
        "APP_ENV should have production value");
      
      // Make sure old base values are not present
      assertEquals(prodEnv.includes("NODE_ENV=development"), false, 
        "Original NODE_ENV value should be replaced");
      assertEquals(prodEnv.includes("DEBUG=true"), false, 
        "Original DEBUG value should be replaced");
    });
  },
});
