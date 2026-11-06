import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.join(projectRoot, '_site');
const errors = [];
const htmlCache = new Map();
const origin = 'https://pages-validation.invalid';
const publishedOrigin = 'https://van-lord.github.io';
const galleryUrl = '/gallery/';
let checkedReferences = 0;

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function decodeEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      return String.fromCodePoint(Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    return ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' })[entity.toLowerCase()] ?? match;
  });
}

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([^\s=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return result;
}

function tags(html) {
  // Static output is controlled by our generator. Exclude scripts and comments
  // so strings inside JavaScript cannot masquerade as document links.
  const markup = html.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<(script|style)\b[^>]*>)[\s\S]*?<\/\2\s*>/gi, '$1');
  return [...markup.matchAll(/<([a-z][\w:-]*)\b[^>]*>/gi)]
    .map((match) => ({ name: match[1].toLowerCase(), attrs: attributes(match[0]) }));
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const location = path.join(directory, entry.name);
    assert(!entry.isSymbolicLink(), `Symbolic link in Pages output: ${path.relative(siteRoot, location)}`);
    if (entry.isDirectory()) files.push(...await walk(location));
    else if (entry.isFile()) files.push(location);
  }
  return files;
}

async function htmlAt(file) {
  if (!htmlCache.has(file)) htmlCache.set(file, await readFile(file, 'utf8'));
  return htmlCache.get(file);
}

async function resolveFile(url, label) {
  let location;
  try {
    location = path.resolve(siteRoot, `.${decodeURIComponent(url.pathname)}`);
  } catch {
    errors.push(`${label}: invalid URL encoding ${url.pathname}`);
    return null;
  }
  if (location !== siteRoot && !location.startsWith(siteRoot + path.sep)) {
    errors.push(`${label}: reference escapes the output directory`);
    return null;
  }
  try {
    if ((await stat(location)).isDirectory()) location = path.join(location, 'index.html');
    if (!(await stat(location)).isFile()) throw new Error('Not a file');
    return location;
  } catch {
    errors.push(`${label}: missing local file ${url.pathname}`);
    return null;
  }
}

async function checkReference(reference, pageUrl, label, checkAnchor = false) {
  if (!reference) return;
  let url;
  try { url = new URL(reference, pageUrl); }
  catch { errors.push(`${label}: invalid reference ${reference}`); return; }
  assert(url.protocol !== 'javascript:', `${label}: JavaScript URL is not allowed`);
  if (url.origin === publishedOrigin) url = new URL(url.pathname + url.search + url.hash, origin);
  if (url.origin !== origin) return;
  checkedReferences += 1;
  const file = await resolveFile(url, label);
  if (!file || !checkAnchor || !url.hash || !file.endsWith('.html')) return;
  let anchor;
  try { anchor = decodeURIComponent(url.hash.slice(1)); }
  catch { errors.push(`${label}: invalid anchor encoding ${url.hash}`); return; }
  if (!anchor || anchor.startsWith(':~:text=')) return;
  const destinationTags = tags(await htmlAt(file));
  assert(destinationTags.some(({ attrs }) => attrs.id === anchor || attrs.name === anchor),
    `${label}: missing anchor ${url.pathname}${url.hash}`);
}

async function checkHtml(file) {
  const relative = path.relative(siteRoot, file).split(path.sep).join('/');
  const pageUrl = new URL(`/${relative.replace(/index\.html$/, '')}`, origin);
  const html = await htmlAt(file);
  const elements = tags(html);
  const metas = elements.filter(({ name }) => name === 'meta').map(({ attrs }) => attrs);
  const hasMeta = (name) => metas.some((attrs) => (attrs.name === name || attrs.property === name) && attrs.content?.trim());
  assert(/<title\b[^>]*>\s*[^<]+<\/title>/i.test(html), `${relative}: missing page title`);
  assert(elements.some(({ name, attrs }) => name === 'html' && attrs.lang), `${relative}: missing document language`);
  for (const name of ['description', 'viewport', 'og:title', 'og:description', 'og:image']) {
    assert(hasMeta(name), `${relative}: missing ${name} metadata`);
  }
  assert(elements.some(({ name, attrs }) => name === 'link' && attrs.rel?.split(/\s+/).includes('canonical') && /^https:\/\//.test(attrs.href ?? '')),
    `${relative}: missing absolute HTTPS canonical URL`);
  assert(!/\/api\/admin\b|\/(?:signin|signout)-with-chatgpt\b/i.test(html),
    `${relative}: contains private API or sign-in references`);
  for (const { name, attrs } of elements) {
    for (const attribute of ['href', 'src', 'poster']) {
      if (attrs[attribute]) await checkReference(attrs[attribute], pageUrl, `${relative} ${name}[${attribute}]`, attribute === 'href');
    }
    if (attrs.srcset) {
      for (const candidate of attrs.srcset.split(',')) {
        const reference = candidate.trim().split(/\s+/)[0];
        await checkReference(reference, pageUrl, `${relative} ${name}[srcset]`);
      }
    }
  }
}

let files;
try { files = await walk(siteRoot); }
catch (error) { throw new Error(`Cannot read _site. Run npm run build:pages first. ${error.message}`); }
const htmlFiles = files.filter((file) => file.endsWith('.html'));
assert(htmlFiles.includes(path.join(siteRoot, 'index.html')), 'Missing homepage _site/index.html');
for (const file of htmlFiles) await checkHtml(file);

const homepage = await htmlAt(path.join(siteRoot, 'index.html'));
const homepageTags = tags(homepage);
assert(!homepage.includes('<!--ssr-outlet-->'), 'Homepage was not server rendered');
assert(homepageTags.some(({ name }) => name === 'h1'), 'Homepage has no rendered primary heading');
assert(homepageTags.some(({ name, attrs }) => name === 'a' && attrs.href === galleryUrl),
  'Homepage must link to the local GitHub Pages Gallery');
const galleryDataText = await readFile(path.join(projectRoot, 'data', 'gallery.json'), 'utf8');
const galleryAlbums = JSON.parse(galleryDataText);
const galleryPhotos = galleryAlbums.flatMap((album) => album.photos);
assert(galleryAlbums.length > 0 && galleryPhotos.length > 0, 'Published Gallery snapshot must not be empty');
assert(!/\"(?:ownerEmail|storageKey|createdAt|updatedAt|published)\"\s*:/.test(galleryDataText), 'Gallery snapshot contains private storage or account fields');
assert(new Set(galleryPhotos.map((photo) => photo.id)).size === galleryPhotos.length, 'Gallery photographs must not be duplicated or omitted');
const archiveFile = path.join(siteRoot, 'gallery', 'index.html');
assert(htmlFiles.includes(archiveFile), 'Missing local Gallery index');
const archiveHtml = await htmlAt(archiveFile);
for (const album of galleryAlbums) {
  const albumFile = path.join(siteRoot, 'gallery', album.slug, 'index.html');
  assert(htmlFiles.includes(albumFile), `Missing photo story: ${album.slug}`);
  const albumHtml = await htmlAt(albumFile);
  assert(decodeEntities(albumHtml).includes(album.title), `Missing story title: ${album.title}`);
  assert(archiveHtml.includes(`/gallery/${album.slug}/`), `Story absent from Gallery index: ${album.slug}`);
  for (const photo of album.photos) {
    assert(/^\/photos\/[a-zA-Z0-9-]+\.jpg$/.test(photo.url), `Photo does not use a local asset: ${photo.url}`);
    assert(albumHtml.includes(`src=\"${photo.url}\"`), `Photo absent from story: ${photo.id}`);
    const bytes = await readFile(path.join(siteRoot, photo.url));
    assert(bytes[0] === 0xff && bytes[1] === 0xd8, `Invalid JPEG for photograph: ${photo.id}`);
  }
}
assert(htmlFiles.length === galleryAlbums.length + 3, 'Output must contain home, Gallery, every story, and404 only');
const { publications } = JSON.parse(await readFile(path.join(projectRoot, 'data', 'portfolio.json'), 'utf8'));
const visibleContent = decodeEntities(homepage.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ');
assert(publications.length > 0, 'Publication data is empty');
for (const publication of publications) {
  assert(visibleContent.includes(publication.title.replace(/\s+/g, ' ')),
    `Publication absent from rendered homepage: ${publication.title}`);
}

for (const file of files) {
  const relative = path.relative(siteRoot, file).split(path.sep).join('/');
  assert(!/(?:^|\/)(?:\.openai|\.env[^/]*|node_modules|api|db|scripts)(?:\/|$)|\.(?:tsx?|map)$/i.test(relative),
    `Private or unnecessary source artifact in Pages output: ${relative}`);
  if (file.endsWith('.css')) {
    const css = await readFile(file, 'utf8');
    for (const match of css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/gi)) {
      await checkReference(match[1], new URL('/' + relative, origin), `${relative} CSS asset`);
    }
  }
  if (file.endsWith('.js')) {
    const javascript = await readFile(file, 'utf8');
    assert(!/\/api\/admin\b|oai-authenticated-user-email|siwc_bypass_bearer_token|appgprj_/i.test(javascript),
      `${relative}: contains server-only interface or Site identity`);
    for (const match of javascript.matchAll(/(?:from\s*|import\s*\(?)['"](\.\.?\/[^'"]+\.js)['"]/g)) {
      await checkReference(match[1], new URL('/' + relative, origin), `${relative} JavaScript module`);
    }
  }
}

if (errors.length) {
  for (const error of errors) console.error(`FAIL ${error}`);
  throw new Error(`Pages validation failed with ${errors.length} error(s).`);
}
console.log(`Pages validation passed: ${htmlFiles.length} HTML pages, ${publications.length} publications, ${galleryAlbums.length} local albums, ${galleryPhotos.length} photographs, ${checkedReferences} local references.`);
