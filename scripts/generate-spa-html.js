import { readdir, writeFile, copyFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const clientDir = join(rootDir, "dist", "client");
const assetsDir = join(clientDir, "assets");
const publicDir = join(rootDir, "public");
const outputDir = clientDir;

// Determine base path for GitHub Pages
const basePath = process.env.BASE_URL ?? "/vega_studio/";

async function generateHtml() {
  const files = await readdir(assetsDir);

  const cssFile = files.find((f) => f.endsWith(".css"));
  const jsFiles = files.filter((f) => f.endsWith(".js") && !f.startsWith("server"));

  if (!cssFile) {
    console.error("No CSS file found in", assetsDir);
    process.exit(1);
  }
  if (jsFiles.length === 0) {
    console.error("No JS files found in", assetsDir);
    process.exit(1);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vega Studio — Chart Builder</title>
    <meta name="description" content="Build Vega-Lite charts visually: add data, pick layouts, tune colors and marks, and export the generated spec." />
    <meta property="og:title" content="Vega-Lite Chart Builder" />
    <meta property="og:description" content="Compose Vega-Lite charts with a live preview and instantly copy the generated JSON spec." />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" type="image/x-icon" href="${basePath}favicon.ico" />
    <link rel="stylesheet" href="${basePath}assets/${cssFile}" />
  </head>
  <body>
    <div id="root"></div>
${jsFiles.map((f) => `    <script type="module" src="${basePath}assets/${f}"></script>`).join("\n")}
  </body>
</html>
`;

  await writeFile(join(outputDir, "index.html"), html);
  console.log("✅ Generated index.html with assets:", { cssFile, jsFiles });

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
  await writeFile(join(outputDir, "404.html"), page404);
  console.log("✅ Generated 404.html for SPA routing");

  // Copy public files to output
  try {
    await copyFile(join(publicDir, "favicon.ico"), join(outputDir, "favicon.ico"));
    await copyFile(join(publicDir, ".nojekyll"), join(outputDir, ".nojekyll"));
    console.log("✅ Copied public files to output");
  } catch (err) {
    console.warn("⚠️ Could not copy public files:", err.message);
  }
}

generateHtml().catch((err) => {
  console.error("Failed to generate HTML:", err);
  process.exit(1);
});
