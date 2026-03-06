import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_PNG = "web/public/logo.png";
const DEFAULT_ICO = "web/public/logo.ico";

function parseArg(flag: string): string | null {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === flag) {
      return args[i + 1] ?? null;
    }
    if (args[i].startsWith(`${flag}=`)) {
      return args[i].slice(flag.length + 1);
    }
  }
  return null;
}

function printUsage(): void {
  console.log(
    [
      "Generate Windows .ico from PNG for Electrobun/Bun builds.",
      "",
      "Usage:",
      "  bun run scripts/generate-windows-icon.ts [--png <path>] [--ico <path>] [--force]",
      "",
      "Defaults:",
      `  --png ${DEFAULT_PNG}`,
      `  --ico ${DEFAULT_ICO}`,
    ].join("\n")
  );
}

function isLikelyIco(content: Buffer): boolean {
  if (content.length < 6) {
    return false;
  }
  const reserved = content.readUInt16LE(0);
  const imageType = content.readUInt16LE(2);
  const imageCount = content.readUInt16LE(4);
  return reserved === 0 && imageType === 1 && imageCount > 0;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("-h") || args.includes("--help")) {
    printUsage();
    return;
  }
  const force = args.includes("--force");

  const pngPath = resolve(process.cwd(), parseArg("--png") || DEFAULT_PNG);
  const icoPath = resolve(process.cwd(), parseArg("--ico") || DEFAULT_ICO);

  if (!force) {
    try {
      const existing = await readFile(icoPath);
      if (isLikelyIco(existing)) {
        console.log(`[icon] Reusing existing ICO: ${icoPath}`);
        console.log(`[icon] Size: ${existing.length} bytes`);
        return;
      }
    } catch {
      // ignore and continue to generation path
    }
  }

  let pngInfo;
  try {
    pngInfo = await stat(pngPath);
  } catch {
    throw new Error(`PNG not found: ${pngPath}`);
  }
  if (!pngInfo.isFile() || pngInfo.size <= 0) {
    throw new Error(`PNG is invalid or empty: ${pngPath}`);
  }

  const pngToIcoModule = await import("png-to-ico");
  const pngToIco = pngToIcoModule.default;
  let icoBuffer: Buffer;
  try {
    icoBuffer = await pngToIco(pngPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("square png")) {
      throw new Error(
        `PNG must be square for ICO conversion: ${pngPath}. ` +
          "Please provide a square image via --png (e.g. 512x512)."
      );
    }
    throw error;
  }

  await mkdir(dirname(icoPath), { recursive: true });
  await writeFile(icoPath, icoBuffer);

  const written = await readFile(icoPath);
  if (!isLikelyIco(written)) {
    throw new Error(`Generated file is not a valid ICO header: ${icoPath}`);
  }

  console.log(`[icon] PNG: ${pngPath}`);
  console.log(`[icon] ICO: ${icoPath}`);
  console.log(`[icon] Size: ${written.length} bytes`);
  console.log("[icon] Windows icon generated successfully.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[icon] Failed: ${message}`);
  process.exit(1);
});
