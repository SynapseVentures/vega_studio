import { writeFile, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const outDir = join(rootDir, "dist");
const publicDir = join(rootDir, "public");

// Determine base path for GitHub Pages
const basePath = process.env.BASE_URL ?? "/vega_studio/";

async function main() {
  // Generate 404.html that redirects to index for SPA client-side routing
  const page404 = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="0;url=${basePath}" />
  <script>sessionStorage.redirect = location.pathname; location.replace("${basePath}");</script>
</head>
<body></body>
</html>`;
  await writeFile(join(outDir, "404.html"), page404);
  console.log("✅ Generated 404.html for SPA routing");

  // Copy public files to output
  try {
    await copyFile(join(publicDir, "favicon.ico"), join(outDir, "favicon.ico"));
    await copyFile(join(publicDir, ".nojekyll"), join(outDir, ".nojekyll"));
    console.log("✅ Copied public files to output");
  } catch (err) {
    console.warn("⚠️ Could not copy public files:", err.message);
  }

  console.log("✅ Post-build done — output in dist/");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
