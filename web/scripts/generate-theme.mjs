import "dotenv/config";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const themeColor = process.env.THEME_COLOR || "#2563eb";
const themeColorStrong = adjustBrightness(themeColor, -15);
const themeColorSubtle = adjustBrightness(themeColor, 85);
const themeColorGlow = adjustBrightness(themeColor, 40);
const themeColorMuted = adjustBrightness(themeColor, -5);

const themeCss = `/* Auto-generated theme - do not edit manually */
:root {
  --color-accent: ${themeColor};
  --color-accent-strong: ${themeColorStrong};
  --color-accent-subtle: ${themeColorSubtle};
  --color-accent-glow: ${themeColorGlow};
  --color-accent-muted: ${themeColorMuted};
}
`;

const cssPath = resolve(process.cwd(), "src/styles/_theme.css");
writeFileSync(cssPath, themeCss);
console.log(`[theme] Generated theme with color: ${themeColor}`);

function adjustBrightness(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}