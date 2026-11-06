import "../../public/desk-gallery-arrival.css";

const DESK_PHOTOGRAPH = "/photos/0cd9ca70-1ea6-41f1-b301-9c0f15c629ce.jpg";

// Run in the document head so the photograph is present on the first paint,
// before the streamed gallery or its client components become interactive.
export const DESK_GALLERY_BOOTSTRAP = `(() => {
  try {
    const url = new URL(window.location.href);
    if (!/^\\/gallery\\/?$/.test(url.pathname) || url.searchParams.get("from") !== "desk") return;
    const root = document.documentElement;
    root.dataset.deskGalleryArrival = "pending";
    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "image";
    preload.href = ${JSON.stringify(DESK_PHOTOGRAPH)};
    preload.fetchPriority = "high";
    document.head.appendChild(preload);
    url.searchParams.delete("from");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    window.setTimeout(() => { delete root.dataset.deskGalleryArrival; }, 3800);
  } catch (_) {}
})();`;

const ARRIVAL_LIFECYCLE = `(() => {
  const root = document.documentElement;
  if (!root.dataset.deskGalleryArrival) return;
  const layer = document.getElementById("desk-gallery-arrival");
  if (!layer) { delete root.dataset.deskGalleryArrival; return; }
  let ended = false;
  let revealTimer = 0;
  let finishTimer = 0;
  const finish = () => {
    if (ended) return;
    ended = true;
    delete root.dataset.deskGalleryArrival;
    window.clearTimeout(revealTimer);
    window.clearTimeout(finishTimer);
    layer.removeEventListener("animationend", animationEnded);
    window.removeEventListener("pagehide", finish);
    window.removeEventListener("pageshow", pageShown);
    document.removeEventListener("DOMContentLoaded", prepare);
  };
  const animationEnded = (event) => { if (event.target === layer) finish(); };
  const pageShown = (event) => { if (event.persisted) finish(); };
  const reveal = () => {
    if (ended || root.dataset.deskGalleryArrival === "revealing") return;
    window.clearTimeout(revealTimer);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { finish(); return; }
    // Two frames let the decoded photograph reach the compositor before it
    // dissolves, including when the destination came from a warm cache.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      if (ended) return;
      root.dataset.deskGalleryArrival = "revealing";
      finishTimer = window.setTimeout(finish, 1000);
    }));
  };
  const decoded = (image) => image && image.decode ? image.decode().catch(() => {}) : Promise.resolve();
  const prepare = () => {
    if (ended) return;
    if (!document.querySelector(".gallery-index-page")) { finish(); return; }
    const images = Array.from(document.querySelectorAll(".gallery-index-grid img")).slice(0, 3);
    const ready = [decoded(layer.querySelector("img")), ...images.map(decoded)];
    if (document.fonts) ready.push(document.fonts.ready);
    // A slow archive image cannot hold the visitor behind the photograph.
    revealTimer = window.setTimeout(reveal, 1000);
    Promise.allSettled(ready).then(reveal);
  };
  layer.addEventListener("animationend", animationEnded);
  window.addEventListener("pagehide", finish);
  window.addEventListener("pageshow", pageShown);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", prepare, { once: true });
  else prepare();
})();`;

/** A one-time bridge from the desk photograph; the gallery itself stays intact. */
export function DeskGalleryArrival() {
  return <>
    <div id="desk-gallery-arrival" className="desk-gallery-arrival" aria-hidden="true">
      <img src={DESK_PHOTOGRAPH} alt="" decoding="sync" fetchPriority="high" />
    </div>
    <script dangerouslySetInnerHTML={{ __html: ARRIVAL_LIFECYCLE }} />
  </>;
}
