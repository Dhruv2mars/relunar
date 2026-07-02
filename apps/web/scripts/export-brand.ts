import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { logoSvg } from "../src/lib/logo-geometry";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brandDir = join(root, "public", "brand");

async function exportBrandAssets(): Promise<void> {
  await mkdir(brandDir, { recursive: true });

  for (const item of [
    { file: "relunar-blackfill.png", variant: "black" as const },
    { file: "relunar-whitefill.png", variant: "white" as const },
  ]) {
    const png = await sharp(Buffer.from(logoSvg(item.variant))).png({ compressionLevel: 9 }).toBuffer();
    await writeFile(join(brandDir, item.file), png);
  }

  await writeFile(join(root, "public", "favicon.svg"), logoSvg("white"));
  await writeFile(
    join(root, "public", "favicon.png"),
    await sharp(Buffer.from(logoSvg("white"))).resize(32, 32).png().toBuffer(),
  );
  await writeFile(
    join(root, "public", "apple-touch-icon.png"),
    await sharp(Buffer.from(logoSvg("white"))).resize(180, 180).png().toBuffer(),
  );

  console.log("Exported Relunar brand assets.");
}

await exportBrandAssets();
