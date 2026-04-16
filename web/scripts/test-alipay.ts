#!/usr/bin/env bun
/**
 * Alipay Configuration Test Script
 *
 * Tests whether Alipay configuration parameters are correctly set.
 * Run with: bun run scripts/test-alipay.ts
 *
 * Tests:
 * 1. Environment variables are present
 * 2. Key formats are valid (RSA2 format)
 * 3. Optional: connectivity to Alipay gateway
 */

import { getEnv } from "../src/lib/env.ts";

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function test(name: string, passed: boolean, message: string): void {
  results.push({ name, passed, message });
  const icon = passed ? "✓" : "✗";
  const color = passed ? "\x1b[32m" : "\x1b[31m";
  console.log(`${color}${icon}\x1b[0m ${name}: ${message}`);
}

function isValidRSA2Key(key: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();

  // Format 1: Standard PEM format with headers/footers
  // Private key: -----BEGIN RSA PRIVATE KEY----- / -----BEGIN PRIVATE KEY-----
  const validBeginPrivate = trimmed.startsWith("-----BEGIN RSA PRIVATE KEY-----") ||
                            trimmed.startsWith("-----BEGIN PRIVATE KEY-----");
  const validEndPrivate = trimmed.endsWith("-----END RSA PRIVATE KEY-----") ||
                          trimmed.endsWith("-----END PRIVATE KEY-----");
  // Public key: -----BEGIN PUBLIC KEY-----
  const validBeginPublic = trimmed.startsWith("-----BEGIN PUBLIC KEY-----");
  const validEndPublic = trimmed.endsWith("-----END PUBLIC KEY-----");

  if ((validBeginPrivate && validEndPrivate) || (validBeginPublic && validEndPublic)) {
    return true;
  }

  // Format 2: Alipay "应用公钥RSA2048.txt" format - raw base64 without PEM headers
  // This is a multiline base64 string, typically starts with MII for RSA2048 public keys
  const base64Regex = /^[A-Za-z0-9+/=\s]+$/;
  const lines = trimmed.split("\n").filter(l => l.trim().length > 0);

  // Remove any possible content description lines (like "应用公钥" label)
  const base64Content = lines.filter(l => !l.includes("：") && !l.includes(":")).join("");

  // Check if it's valid base64 content of appropriate length for RSA2048
  // RSA2048 public key base64 is typically 256+ chars, private key is 512+ chars
  return base64Regex.test(base64Content) && base64Content.length >= 200;
}

async function main() {
  console.log("\n=== Alipay Configuration Test ===\n");

  const env = getEnv();

  // Test 1: Check if ALIPAY_APP_ID is configured
  test(
    "ALIPAY_APP_ID configured",
    !!env.alipayAppId && env.alipayAppId.length > 0,
    env.alipayAppId ? `Configured: ${env.alipayAppId}` : "Not configured"
  );

  // Test 2: Check ALIPAY_APP_ID format (should be numeric string)
  if (env.alipayAppId) {
    test(
      "ALIPAY_APP_ID format",
      /^\d+$/.test(env.alipayAppId),
      /^\d+$/.test(env.alipayAppId)
        ? `Valid numeric format: ${env.alipayAppId}`
        : `Invalid format (should be numeric string): ${env.alipayAppId}`
    );
  }

  // Test 3: Check if ALIPAY_PRIVATE_KEY is configured
  test(
    "ALIPAY_PRIVATE_KEY configured",
    !!env.alipayPrivateKey && env.alipayPrivateKey.length > 0,
    env.alipayPrivateKey
      ? `Configured (${env.alipayPrivateKey.length} chars)`
      : "Not configured"
  );

  // Test 4: Check ALIPAY_PRIVATE_KEY format
  if (env.alipayPrivateKey) {
    const isValidKey = isValidRSA2Key(env.alipayPrivateKey);
    test(
      "ALIPAY_PRIVATE_KEY format",
      isValidKey,
      isValidKey
        ? "Valid RSA2 private key format (PEM or Alipay raw format)"
        : "Invalid RSA2 private key format"
    );
  }

  // Test 5: Check if ALIPAY_PUBLIC_KEY is configured
  test(
    "ALIPAY_PUBLIC_KEY configured",
    !!env.alipayPublicKey && env.alipayPublicKey.length > 0,
    env.alipayPublicKey
      ? `Configured (${env.alipayPublicKey.length} chars)`
      : "Not configured"
  );

  // Test 6: Check ALIPAY_PUBLIC_KEY format
  if (env.alipayPublicKey) {
    const isValidKey = isValidRSA2Key(env.alipayPublicKey);
    test(
      "ALIPAY_PUBLIC_KEY format",
      isValidKey,
      isValidKey
        ? "Valid RSA2 public key format (PEM or Alipay raw format)"
        : "Invalid RSA2 public key format"
    );
  }

  // Test 7: Check ALIPAY_GATEWAY
  const defaultGateway = "https://openapi.alipay.com/gateway.do";
  test(
    "ALIPAY_GATEWAY configured",
    !!env.alipayGateway && env.alipayGateway.length > 0,
    env.alipayGateway
      ? `Configured: ${env.alipayGateway}`
      : `Using default: ${defaultGateway}`
  );

  // Test 8: Check ALIPAY_GATEWAY URL format
  if (env.alipayGateway) {
    try {
      const url = new URL(env.alipayGateway);
      test(
        "ALIPAY_GATEWAY URL format",
        url.protocol === "https:",
        url.protocol === "https:"
          ? `Valid HTTPS URL: ${env.alipayGateway}`
          : `Warning: Using non-HTTPS URL: ${env.alipayGateway}`
      );
    } catch {
      test(
        "ALIPAY_GATEWAY URL format",
        false,
        `Invalid URL format: ${env.alipayGateway}`
      );
    }
  }

  // Test 9: Check ALIPAY_NOTIFY_URL (optional but recommended)
  test(
    "ALIPAY_NOTIFY_URL configured",
    !!env.alipayNotifyUrl && env.alipayNotifyUrl.length > 0,
    env.alipayNotifyUrl
      ? `Configured: ${env.alipayNotifyUrl}`
      : "Not configured (optional - payment notifications won't work)"
  );

  // Test 10: Check if Alipay SDK can be instantiated
  const { isAlipayConfigured } = await import("../src/lib/alipay.ts");
  test(
    "Alipay SDK instantiation",
    isAlipayConfigured(),
    isAlipayConfigured()
      ? "Successfully created Alipay SDK client"
      : "Failed to create Alipay SDK client (check key format)"
  );

  // Summary
  console.log("\n=== Summary ===");
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const allPassed = passed === total;

  if (allPassed) {
    console.log(`\x1b[32m✓ All ${total} tests passed!\x1b[0m`);
  } else {
    console.log(`\x1b[33m⚠ ${passed}/${total} tests passed, ${total - passed} failed.\x1b[0m`);
    console.log("\nFailed tests:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
  }

  console.log("");

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("\x1b[31mError running tests:\x1b[0m", err);
  process.exit(1);
});
