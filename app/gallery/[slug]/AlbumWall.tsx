"use client";

import { useEffect, useState } from "react";

type AlbumWallPhoto = {
  id: string;
  url: string;
  altText?: string | null;
  caption?: string | null;
  originalName: string;
};

export function AlbumWall({ photos, title, totalPhotos }: { photos: AlbumWallPhoto[]; title: string; totalPhotos: number }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activePhoto = activeIndex === null ? null : photos[activeIndex];

  useEffect(() => {
    if (activeIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft") setActiveIndex((index) => index === null ? null : (index - 1 + photos.length) % photos.length);
      if (event.key === "ArrowRight") setActiveIndex((index) => index === null ? null : (index + 1) % photos.length);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, photos.length]);

  return (
    <>
      <div className="archive-wall">
        {photos.map((photo, index) => (
          <figure className={`archive-wall-photo archive-wall-photo-${index + 1}`} id={`frame-${index + 1}`} key={photo.id}>
            <button type="button" className="archive-photo-open" onClick={() => setActiveIndex(index)} aria-label={`Open photograph ${index + 1} full screen`}>
              <img className="archive-photo-preview" src={photo.url} alt={photo.altText || `${title}, photograph ${index + 1}`} />
            </button>
            <figcaption><span>{String(index + 1).padStart(2, "0")}</span><span>{photo.caption || photo.originalName}</span></figcaption>
          </figure>
        ))}
      </div>
      {activePhoto && activeIndex !== null && (
        <div className="archive-photo-viewer is-open" role="dialog" aria-modal="true" aria-label={`Full screen photograph ${activeIndex + 1}`}>
          {photos.length > 1 && <button type="button" className="archive-photo-direction archive-photo-previous" onClick={() => setActiveIndex((activeIndex - 1 + photos.length) % photos.length)} aria-label="Previous photograph">‹</button>}
          <button type="button" className="archive-photo-close" onClick={() => setActiveIndex(null)} aria-label="Close full screen photograph">Close <span aria-hidden="true">×</span></button>
          <img src={activePhoto.url} alt={activePhoto.altText || `${title}, photograph ${activeIndex + 1}`} />
          {photos.length > 1 && <button type="button" className="archive-photo-direction archive-photo-next" onClick={() => setActiveIndex((activeIndex + 1) % photos.length)} aria-label="Next photograph">›</button>}
          <p><b>{title}</b><span>{String(activeIndex + 1).padStart(2, "0")} / {String(totalPhotos).padStart(2, "0")} · {activePhoto.caption || activePhoto.originalName}</span></p>
        </div>
      )}
    </>
  );
}
