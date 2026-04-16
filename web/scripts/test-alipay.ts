#!/usr/bin/env bun
/**
 * Alipay Configuration & Order Simulation Test Script
 *
 * Run with: bun run scripts/test-alipay.ts
 *
 * Features:
 * 1. Test whether Alipay configuration parameters are correctly set
 * 2. Simulate order submission and get payment QR code / page pay URL
 * 3. Optionally query order payment status
 */

import { getEnv } from "../src/lib/env.ts";
import {
  createQrCodeOrder,
  createPagePayOrder,
  createWapPayOrder,
  queryOrderStatus,
  isAlipayConfigured,
} from "../src/lib/alipay.ts";

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

  // PEM format
  const validBeginPrivate = trimmed.startsWith("-----BEGIN RSA PRIVATE KEY-----") ||
                            trimmed.startsWith("-----BEGIN PRIVATE KEY-----");
  const validEndPrivate = trimmed.endsWith("-----END RSA PRIVATE KEY-----") ||
                          trimmed.endsWith("-----END PRIVATE KEY-----");
  const validBeginPublic = trimmed.startsWith("-----BEGIN PUBLIC KEY-----");
  const validEndPublic = trimmed.endsWith("-----END PUBLIC KEY-----");

  if ((validBeginPrivate && validEndPrivate) || (validBeginPublic && validEndPublic)) {
    return true;
  }

  // Alipay raw format - raw base64 without PEM headers
  const base64Regex = /^[A-Za-z0-9+/=\s]+$/;
  const lines = trimmed.split("\n").filter(l => l.trim().length > 0);
  const base64Content = lines.filter(l => !l.includes("：") && !l.includes(":")).join("");
  return base64Regex.test(base64Content) && base64Content.length >= 200;
}

async function runConfigTests() {
  console.log("\n=== Alipay Configuration Tests ===\n");

  const env = getEnv();

  test(
    "ALIPAY_APP_ID configured",
    !!env.alipayAppId && env.alipayAppId.length > 0,
    env.alipayAppId ? `Configured: ${env.alipayAppId}` : "Not configured"
  );

  if (env.alipayAppId) {
    test(
      "ALIPAY_APP_ID format",
      /^\d+$/.test(env.alipayAppId),
      /^\d+$/.test(env.alipayAppId)
        ? `Valid numeric format: ${env.alipayAppId}`
        : `Invalid format (should be numeric string): ${env.alipayAppId}`
    );
  }

  test(
    "ALIPAY_PRIVATE_KEY configured",
    !!env.alipayPrivateKey && env.alipayPrivateKey.length > 0,
    env.alipayPrivateKey
      ? `Configured (${env.alipayPrivateKey.length} chars)`
      : "Not configured"
  );

  if (env.alipayPrivateKey) {
    const isValidKey = isValidRSA2Key(env.alipayPrivateKey);
    test(
      "ALIPAY_PRIVATE_KEY format",
      isValidKey,
      isValidKey
        ? "Valid RSA2 private key format"
        : "Invalid RSA2 private key format"
    );
  }

  test(
    "ALIPAY_PUBLIC_KEY configured",
    !!env.alipayPublicKey && env.alipayPublicKey.length > 0,
    env.alipayPublicKey
      ? `Configured (${env.alipayPublicKey.length} chars)`
      : "Not configured"
  );

  if (env.alipayPublicKey) {
    const isValidKey = isValidRSA2Key(env.alipayPublicKey);
    test(
      "ALIPAY_PUBLIC_KEY format",
      isValidKey,
      isValidKey
        ? "Valid RSA2 public key format"
        : "Invalid RSA2 public key format"
    );
  }

  const defaultGateway = "https://openapi.alipay.com/gateway.do";
  test(
    "ALIPAY_GATEWAY configured",
    !!env.alipayGateway && env.alipayGateway.length > 0,
    env.alipayGateway
      ? `Configured: ${env.alipayGateway}`
      : `Using default: ${defaultGateway}`
  );

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
      test("ALIPAY_GATEWAY URL format", false, `Invalid URL format: ${env.alipayGateway}`);
    }
  }

  test(
    "ALIPAY_NOTIFY_URL configured",
    !!env.alipayNotifyUrl && env.alipayNotifyUrl.length > 0,
    env.alipayNotifyUrl
      ? `Configured: ${env.alipayNotifyUrl}`
      : "Not configured (optional)"
  );

  test(
    "Alipay SDK instantiation",
    isAlipayConfigured(),
    isAlipayConfigured()
      ? "Successfully created Alipay SDK client"
      : "Failed to create Alipay SDK client (check key format)"
  );
}

async function runOrderSimulation() {
  console.log("\n=== Order Simulation Test ===\n");

  if (!isAlipayConfigured()) {
    console.log("\x1b[33m⚠ Alipay not configured, skipping order simulation.\x1b[0m");
    console.log("  Configure ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, and ALIPAY_PUBLIC_KEY to enable.\n");
    return;
  }

  const testOrderNo = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const testProduct = {
    name: "测试商品-CLAWOS支付测试",
    priceCny: "0.01",
  };

  console.log(`Test order: ${testOrderNo}`);
  console.log(`Product: ${testProduct.name}`);
  console.log(`Price: ¥${testProduct.priceCny}\n`);

  // Test 1: Simulate QR code order (alipay.trade.precreate)
  console.log("\x1b[36m[Test 1] QR Code Order (alipay.trade.precreate)\x1b[0m");
  try {
    const qrResult = await createQrCodeOrder({
      outTradeNo: `${testOrderNo}-qr`,
      totalAmount: testProduct.priceCny,
      subject: testProduct.name,
    });
    console.log(`\x1b[32m✓ QR Code created successfully\x1b[0m`);
    console.log(`  outTradeNo: ${qrResult.outTradeNo}`);
    console.log(`  qrCodeUrl: ${qrResult.qrCodeUrl}`);
    results.push({
      name: "QR Code Order",
      passed: true,
      message: `Created: ${qrResult.outTradeNo}`,
    });
  } catch (err) {
    const error = err as Error;
    console.log(`\x1b[31m✗ QR Code order failed: ${error.message}\x1b[0m`);
    results.push({
      name: "QR Code Order",
      passed: false,
      message: error.message,
    });
  }

  // Test 2: Query order status
  console.log("\n\x1b[36m[Test 2] Query Order Status\x1b[0m");
  try {
    const statusResult = await queryOrderStatus(`${testOrderNo}-qr`);
    console.log(`\x1b[32m✓ Query succeeded\x1b[0m`);
    console.log(`  Status: ${statusResult.status}`);
    if (statusResult.tradeNo) {
      console.log(`  tradeNo: ${statusResult.tradeNo}`);
    }
    results.push({
      name: "Query Order Status",
      passed: true,
      message: `Status: ${statusResult.status}`,
    });
  } catch (err) {
    const error = err as Error;
    console.log(`\x1b[31m✗ Query failed: ${error.message}\x1b[0m`);
    results.push({
      name: "Query Order Status",
      passed: false,
      message: error.message,
    });
  }

  // Test 3: Simulate page pay order (alipay.trade.page.pay)
  console.log("\n\x1b[36m[Test 3] Page Pay Order (alipay.trade.page.pay)\x1b[0m");
  try {
    const returnUrl = "https://example.com/pay-success";
    const pageResult = await createPagePayOrder({
      outTradeNo: `${testOrderNo}-page`,
      totalAmount: testProduct.priceCny,
      subject: testProduct.name,
      returnUrl,
    });
    console.log(`\x1b[32m✓ Page Pay created successfully\x1b[0m`);
    console.log(`  outTradeNo: ${pageResult.outTradeNo}`);
    console.log(`  payUrl: ${pageResult.payUrl}`);
    results.push({
      name: "Page Pay Order",
      passed: true,
      message: `Created: ${pageResult.outTradeNo}`,
    });
  } catch (err) {
    const error = err as Error;
    console.log(`\x1b[31m✗ Page Pay order failed: ${error.message}\x1b[0m`);
    results.push({
      name: "Page Pay Order",
      passed: false,
      message: error.message,
    });
  }

  // Test 4: Simulate WAP pay order (alipay.trade.wap.pay)
  console.log("\n\x1b[36m[Test 4] WAP Pay Order (alipay.trade.wap.pay)\x1b[0m");
  try {
    const returnUrl = "https://example.com/pay-success";
    const wapResult = await createWapPayOrder({
      outTradeNo: `${testOrderNo}-wap`,
      totalAmount: testProduct.priceCny,
      subject: testProduct.name,
      returnUrl,
    });
    console.log(`\x1b[32m✓ WAP Pay created successfully\x1b[0m`);
    console.log(`  outTradeNo: ${wapResult.outTradeNo}`);
    console.log(`  payUrl: ${wapResult.payUrl}`);
    results.push({
      name: "WAP Pay Order",
      passed: true,
      message: `Created: ${wapResult.outTradeNo}`,
    });
  } catch (err) {
    const error = err as Error;
    console.log(`\x1b[31m✗ WAP Pay order failed: ${error.message}\x1b[0m`);
    results.push({
      name: "WAP Pay Order",
      passed: false,
      message: error.message,
    });
  }

  // Summary for order simulation
  console.log("\n\x1b[1m=== Order Simulation Summary ===\x1b[0m");
  console.log("\nNote: Test orders have amount ¥0.01 and can be used to verify");
  console.log("Alipay integration. They will NOT trigger actual payment processing.");
  console.log("\nTo test payment flow:");
  console.log("1. QR Code: Scan the qrCodeUrl with Alipay app");
  console.log("2. Page Pay: Open the payUrl in browser\n");
}

async function main() {
  await runConfigTests();
  await runOrderSimulation();

  // Final summary
  console.log("\n=== Final Summary ===");
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