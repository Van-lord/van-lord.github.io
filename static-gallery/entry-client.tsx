import { createElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { GalleryApp } from "./GalleryApp";
import "./preflight.css";
import "./gallery.css";
import "../public/desk-gallery-arrival.css";

const root = document.getElementById("root");
if (root) hydrateRoot(root, createElement(GalleryApp, { pathname: window.location.pathname }));
