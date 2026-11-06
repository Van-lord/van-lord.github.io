import gallery from "../data/gallery.json";
import { AlbumIntro } from "../app/gallery/[slug]/AlbumIntro";
import { AlbumWall } from "../app/gallery/[slug]/AlbumWall";

type Photo = { id: string; url: string; alt?: string; altText?: string; caption?: string; originalName?: string };
type Album = { slug: string; title: string; description?: string; year?: string; photos: Photo[] };

export const albums = gallery as Album[];
const photoAlt = (photo: Photo, album: Album) => photo.altText || photo.alt || album.title;
export const albumPath = (slug: string) => `/gallery/${slug}/`;

function GalleryIndex() {
  const totalFrames = albums.reduce((sum, album) => sum + album.photos.length, 0);
  return <main className="gallery-index-page">
    <header className="site-nav album-page-nav gallery-index-nav" aria-label="Gallery navigation">
      <a className="wordmark" href="/" aria-label="Jiawei Guo, home">JG<span>°</span></a>
      <nav><a href="/#research">Research</a><a className="is-active" href="/gallery/">Gallery</a></nav>
      <a className="nav-contact" href="/">Return home <span aria-hidden="true">×</span></a>
    </header>
    <section className="gallery-index-shell" aria-labelledby="gallery-index-title">
      <aside className="gallery-index-intro">
        <div aria-hidden="true" />
        <div className="gallery-index-title-block">
          <h1 id="gallery-index-title">Stories<br /><span>observed.</span></h1>
          <p className="gallery-index-copy">
            <span className="gallery-index-copy-en" lang="en">To see is a right. To be seen is an obligation. To record is a responsibility.</span>
            <span className="gallery-index-copy-zh" lang="zh-CN">看见是种权利，被看见是种义务，记录是种责任<small className="gallery-index-copy-aside">（瞎<span className="gallery-index-copy-emoji">🐔8️⃣</span>拍的）</small></span>
          </p>
        </div>
        <dl className="gallery-index-summary">
          <div><dt>Stories</dt><dd>{String(albums.length).padStart(2, "0")}</dd></div>
          <div><dt>Frames</dt><dd>{String(totalFrames).padStart(2, "0")}</dd></div>
          <div><dt>Archive</dt><dd>Ongoing</dd></div>
          <div><dt>Author</dt><dd>J. Guo</dd></div>
        </dl>
      </aside>
      <div className="gallery-index-collection">
        <header><span>Collection</span><span>{String(albums.length).padStart(2, "0")} stories</span></header>
        <div className="gallery-index-grid">
          {albums.map((album, index) => <a className="gallery-index-card" href={albumPath(album.slug)} key={album.slug}>
            {album.photos[0] ? <img src={album.photos[0].url} alt={photoAlt(album.photos[0], album)} /> : <span className="gallery-index-placeholder" aria-hidden="true" />}
            <span className="gallery-index-card-number">{String(index + 1).padStart(2, "0")}</span>
            <strong className="gallery-index-card-title">{album.title}</strong>
            <span className="gallery-index-card-open">Open story <b aria-hidden="true">↗</b></span>
          </a>)}
        </div>
      </div>
    </section>
  </main>;
}

function AlbumPage({ album }: { album: Album }) {
  const photos = album.photos.map((photo) => ({
    id: photo.id, url: photo.url, altText: photoAlt(photo, album), caption: photo.caption || "",
    originalName: photo.originalName || `${photo.id}.jpg`,
  }));
  return <main className="album-page archive-page">
    <AlbumIntro title={album.title} firstPhotoUrl={photos[0]?.url} />
    <header className="site-nav album-page-nav">
      <a className="wordmark" href="/">JG<span>°</span></a>
      <nav><a href="/#research">Research</a><a href="/gallery/">Gallery</a></nav>
      <a className="nav-contact" href="/gallery/">Close story <span aria-hidden="true">×</span></a>
    </header>
    <section className="archive-story" aria-labelledby="archive-title">
      <aside className="archive-identity"><div className="archive-title-block">
        <h1 id="archive-title">{album.title}</h1>
        {album.description && <p className="archive-description">{album.description}</p>}
        <dl className="archive-facts"><div><dt>Year</dt><dd>{album.year || "Ongoing"}</dd></div><div><dt>Frames</dt><dd>{String(photos.length).padStart(2, "0")}</dd></div></dl>
      </div></aside>
      <div className="archive-exhibition">
        <div className="archive-view-meta"><span>Wall view</span><span>Sequence / {String(photos.length).padStart(2, "0")}</span></div>
        <AlbumWall photos={photos} title={album.title} totalPhotos={photos.length} />
        <div className="archive-view-foot"><span>Jiawei Guo photographic archive</span><a href={photos[3] ? "#frame-4" : "#frame-1"}>Continue sequence <b aria-hidden="true">↓</b></a></div>
      </div>
    </section>
  </main>;
}

export function resolveAlbum(pathname: string) {
  const slug = pathname.replace(/^\/gallery\/?/, "").replace(/\/$/, "");
  return albums.find((album) => album.slug === slug);
}

export function GalleryApp({ pathname }: { pathname: string }) {
  const album = resolveAlbum(pathname);
  return album ? <AlbumPage album={album} /> : <GalleryIndex />;
}
