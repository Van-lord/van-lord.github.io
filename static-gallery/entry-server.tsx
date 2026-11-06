import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { GalleryApp, albums, albumPath, resolveAlbum } from "./GalleryApp";

export const routes = ["/gallery/", ...albums.map((album) => albumPath(album.slug))];
// The book opens into the live Gallery DOM on the homepage. Direct archive
// visits render the archive immediately, without an intermediate photograph.
export const arrivalBootstrap = "";

export function render(pathname: string) {
  const album = resolveAlbum(pathname);
  const title = album ? `${album.title} — Jiawei Guo` : "Photo Archive — Jiawei Guo";
  const description = album?.description || (album ? `A photo story by Jiawei Guo: ${album.title}` : "Independent photographic stories by Jiawei Guo.");
  return {
    markup: renderToString(createElement(GalleryApp, { pathname })),
    arrival: "",
    title, description,
    image: album?.photos[0]?.url || albums[0]?.photos[0]?.url || "/photos/0cd9ca70-1ea6-41f1-b301-9c0f15c629ce.jpg",
  };
}
