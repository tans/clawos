const OBFUSCATION_BYTES = [0x2d, 0x61, 0x19, 0x73, 0x4f, 0x87, 0x3a, 0x5c] as const;

export const WALLET_OBFUSCATION_ALGORITHM = "reverse-xor-base64url-v1";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function reverseText(input: string): string {
  return Array.from(input).reverse().join("");
}

function transformBytes(input: Uint8Array): Uint8Array {
  const out = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const mask = (OBFUSCATION_BYTES[i % OBFUSCATION_BYTES.length] + (i * 17) % 256) & 0xff;
    out[i] = input[i] ^ mask;
  }
  return out;
}

export function obfuscateSecret(plainText: string): string {
  const reversed = reverseText(plainText);
  const raw = textEncoder.encode(reversed);
  const transformed = transformBytes(raw);
  return Buffer.from(transformed).toString("base64url");
}

export function deobfuscateSecret(obfuscated: string): string {
  const transformed = new Uint8Array(Buffer.from(obfuscated, "base64url"));
  const raw = transformBytes(transformed);
  const reversed = textDecoder.decode(raw);
  return reverseText(reversed);
}
