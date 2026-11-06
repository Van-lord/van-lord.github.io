import { createElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { GalleryApp } from "./GalleryApp";
import "../public/gallery-page.css";

const root = document.getElementById("root");
if (root) {
  const application = hydrateRoot(root, createElement(GalleryApp, { pathname: window.location.pathname }));
  window.addEventListener("popstate", () => {
    // If a browser evicts the original book document from its back cache,
    // it restores /gallery/ from this static entry instead. The older home
    // history entry must then load the homepage rather than leave this UI up.
    if (!/^\/gallery(?:\/|$)/.test(window.location.pathname)) {
      window.location.reload();
      return;
    }
    application.render(createElement(GalleryApp, { pathname: window.location.pathname }));
  });
}
