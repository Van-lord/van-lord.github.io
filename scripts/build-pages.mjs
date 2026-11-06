import { build } from "vite";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteRoot = path.join(projectRoot, "_site");
const ssrRoot = path.join(projectRoot, "work", "pages-build", "ssr");
const configFile = path.join(projectRoot, "static-home", "vite.config.mjs");
const galleryConfig = path.join(projectRoot, "static-gallery", "vite.config.mjs");
const gallery = JSON.parse(await readFile(path.join(projectRoot, "data", "gallery.json"), "utf8"));
const publicAssets = new Set([
  "Jiawei_Guo_CV.pdf", "favicon.svg",
  "fonts/journal-serif.woff2", "fonts/journal-serif-italic.woff2", "fonts/CormorantGaramond-OFL.txt",
  "fonts/SmileySans-Oblique.ttf.woff2", "fonts/SmileySans-OFL.txt",
  "photos/0cd9ca70-1ea6-41f1-b301-9c0f15c629ce.jpg", "photos/76fefc7c-7c0d-454d-8a6c-a3fb683cbf15.jpg",
]);
for (const album of gallery) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(album.slug)) throw new Error(`Unsafe gallery slug: ${album.slug}`);
  for (const photo of album.photos) {
    if (!/^\/photos\/[a-zA-Z0-9-]+\.jpg$/.test(photo.url)) throw new Error(`Unexpected public photograph URL: ${photo.url}`);
    publicAssets.add(photo.url.slice(1));
  }
}
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

try {
  // Share one copy of the original archive rules between the real Gallery
  // routes and the live Gallery page revealed inside the book. Generate it
  // before the homepage build, whose book surface imports the same stylesheet.
  // The checked-in file also supports native builds without a Pages build.
  const preflightStyles = await readFile(path.join(projectRoot, "static-gallery", "preflight.css"), "utf8");
  const galleryStyles = (await readFile(path.join(projectRoot, "app", "globals.css"), "utf8"))
    .replace(/^@import\s+["']tailwindcss["'];\s*/, "")
    .replace(/url\(["']\/neural-network-field\.webp["']\)/g, "none");
  await writeFile(path.join(projectRoot, "public", "gallery-page.css"), `${preflightStyles}\n\n${galleryStyles}`);

  await build({ configFile, build: {
    ssr: path.join(projectRoot, "static-home", "entry-server.tsx"), outDir: ssrRoot, emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: "entry-server.mjs" } },
  } });
  const { render } = await import(pathToFileURL(path.join(ssrRoot, "entry-server.mjs")).href);
  const markup = render();
  await build({ configFile });
  const indexPath = path.join(siteRoot, "index.html");
  const template = await readFile(indexPath, "utf8");
  if (!template.includes("<!--ssr-outlet-->")) throw new Error("Missing homepage SSR outlet.");
  await writeFile(indexPath, template.replace("<!--ssr-outlet-->", () => markup));

  const gallerySsrRoot = path.join(ssrRoot, "gallery");
  await build({ configFile: galleryConfig, build: {
    ssr: path.join(projectRoot, "static-gallery", "entry-server.tsx"), outDir: gallerySsrRoot, emptyOutDir: true,
    rollupOptions: { input: undefined, output: { entryFileNames: "entry-server.mjs" } },
  } });
  const galleryRenderer = await import(pathToFileURL(path.join(gallerySsrRoot, "entry-server.mjs")).href);
  await build({ configFile: galleryConfig, build: { rollupOptions: { input: path.join(projectRoot, "static-gallery", "shell.html") } } });
  const shellPath = path.join(siteRoot, "shell.html");
  const galleryShell = await readFile(shellPath, "utf8");
  for (const route of galleryRenderer.routes) {
    const rendered = galleryRenderer.render(route);
    const substitutions = {
      "__GALLERY_TITLE__": escapeHtml(rendered.title),
      "__GALLERY_DESCRIPTION__": escapeHtml(rendered.description),
      "__GALLERY_URL__": `https://van-lord.github.io${route}`,
      "__GALLERY_IMAGE__": `https://van-lord.github.io${rendered.image}`,
      "__DESK_GALLERY_BOOTSTRAP__": galleryRenderer.arrivalBootstrap,
      "<!--gallery-arrival-->": rendered.arrival,
      "<!--gallery-outlet-->": rendered.markup,
    };
    let html = galleryShell;
    for (const [placeholder, replacement] of Object.entries(substitutions)) html = html.replaceAll(placeholder, () => replacement);
    const directory = path.join(siteRoot, route);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "index.html"), html);
  }
  await rm(shellPath);

  for (const relative of publicAssets) {
    const destination = path.join(siteRoot, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(path.join(projectRoot, "public", relative), destination);
  }
  await cp(path.join(projectRoot, "public", "desk-scene-fallback.svg"), path.join(siteRoot, "desk-scene-fallback.svg"));
  await writeFile(path.join(siteRoot, ".nojekyll"), "");
  await writeFile(path.join(siteRoot, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: https://van-lord.github.io/sitemap.xml\n");
  const urls = ["/", ...galleryRenderer.routes].map((route) => `<url><loc>https://van-lord.github.io${route}</loc></url>`).join("");
  await writeFile(path.join(siteRoot, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`);
  await writeFile(path.join(siteRoot, "404.html"), `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found — Jiawei Guo</title><meta name="description" content="Return to Jiawei Guo’s homepage or photo gallery."><link rel="canonical" href="https://van-lord.github.io/"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><meta property="og:title" content="Jiawei Guo"><meta property="og:description" content="Research and photography."><meta property="og:image" content="https://van-lord.github.io/photos/76fefc7c-7c0d-454d-8a6c-a3fb683cbf15.jpg"><style>body{margin:0;background:#f3f0e8;color:#292923;font:18px/1.7 Georgia,serif}main{max-width:40rem;padding:15vh 8vw}h1{font-size:3rem;font-weight:400}a{color:inherit;text-underline-offset:5px}nav{display:flex;gap:2rem}</style></head><body><main><p>Jiawei Guo / 404</p><h1>This page isn’t here.</h1><p>You can return home or visit the photographic archive.</p><nav><a href="/">Home</a><a href="/gallery/">Gallery</a></nav></main></body></html>\n`);
  console.log(`Built homepage and photographic archive for GitHub Pages: ${gallery.length} albums, ${gallery.reduce((sum, album) => sum + album.photos.length, 0)} photographs.`);
} finally {
  await rm(ssrRoot, { recursive: true, force: true });
}
