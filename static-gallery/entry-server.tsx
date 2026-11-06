import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { DeskGalleryArrival, DESK_GALLERY_BOOTSTRAP } from "../app/components/DeskGalleryArrival";
import { GalleryApp, albums, albumPath, resolveAlbum } from "./GalleryApp";

export const routes = ["/gallery/", ...albums.map((album) => albumPath(album.slug))];
export const arrivalBootstrap = DESK_GALLERY_BOOTSTRAP;

export function render(pathname: string) {
  const album = resolveAlbum(pathname);
  const title = album ? `${album.title} — Jiawei Guo` : "Photo Archive — Jiawei Guo";
  const description = album?.description || (album ? `A photo story by Jiawei Guo: ${album.title}` : "Independent photographic stories by Jiawei Guo.");
  return {
    markup: renderToString(createElement(GalleryApp, { pathname })),
    arrival: album ? "" : renderToString(createElement(DeskGalleryArrival)),
    title, description,
    image: album?.photos[0]?.url || albums[0]?.photos[0]?.url || "/photos/0cd9ca70-1ea6-41f1-b301-9c0f15c629ce.jpg",
  };
}
