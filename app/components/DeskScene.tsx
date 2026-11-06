"use client";

import { useEffect, useRef, useState } from "react";
import albumSequence from "../../data/album-sequence.json";

type SceneTarget = "research" | "gallery";
type SceneFocus = "desk" | "camera" | SceneTarget;
export type ScreenBounds = { left: number; top: number; width: number; height: number };
export type GalleryPagePlacement = { a: number; b: number; c: number; d: number; e: number; f: number };
type DeskSceneProps = {
  className?: string;
  focus?: SceneFocus;
  immersive?: boolean;
  onSelect?: (target: SceneTarget) => void;
  onFocusSettled?: (target: SceneTarget) => void;
  onScreenBounds?: (bounds: ScreenBounds | null) => void;
  onGalleryPage?: (placement: GalleryPagePlacement | null) => void;
};

/** A physical workspace that becomes a close-up when a destination is selected. */
export function DeskScene({ className = "", focus = "desk", immersive = false, onSelect, onFocusSettled, onScreenBounds, onGalleryPage }: DeskSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef(focus);
  const renderRequestRef = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);
  const [settled, setSettled] = useState(true);
  const selectRef = useRef(onSelect);
  const settledRef = useRef(onFocusSettled);
  const screenBoundsRef = useRef(onScreenBounds);
  const galleryPageRef = useRef(onGalleryPage);

  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { settledRef.current = onFocusSettled; }, [onFocusSettled]);
  useEffect(() => { screenBoundsRef.current = onScreenBounds; }, [onScreenBounds]);
  useEffect(() => { galleryPageRef.current = onGalleryPage; }, [onGalleryPage]);

  useEffect(() => {
    focusRef.current = focus;
    setSettled(false);
    if (focus !== "research") screenBoundsRef.current?.(null);
    if (focus !== "gallery" && focus !== "camera") galleryPageRef.current?.(null);
    renderRequestRef.current?.();
  }, [focus]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let teardown: (() => void) | undefined;

    async function mount() {
      const THREE = await import("three");
      if (cancelled || !host) return;
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.32;
      renderer.domElement.setAttribute("aria-hidden", "true");
      Object.assign(renderer.domElement.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "pan-y" });
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-4, 4, 3.5, -3.5, 0.1, 60);
      camera.position.set(8.2, 6.8, 9.2);
      const basePosition = new THREE.Vector3(8.2, 6.8, 9.2);
      const baseCenter = new THREE.Vector3(0, 0.88, 0);
      camera.lookAt(baseCenter);
      const baseQuaternion = camera.quaternion.clone();
      const framingCamera = camera.clone();
      const objects = new THREE.Group();
      objects.rotation.y = -0.16;
      scene.add(objects);

      scene.add(new THREE.HemisphereLight(0xfffcf2, 0xbcb8aa, 2.25));
      const key = new THREE.DirectionalLight(0xfff6e8, 3.4);
      key.position.set(-3, 12, 4);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -5;
      key.shadow.camera.right = 5;
      key.shadow.camera.top = 5;
      key.shadow.camera.bottom = -5;
      key.shadow.normalBias = 0.035;
      key.shadow.bias = -0.0002;
      key.shadow.radius = 5;
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xf0f2f0, 1.3);
      fill.position.set(4, 3, -4);
      scene.add(fill);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.07 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0.035;
      floor.receiveShadow = true;
      scene.add(floor);

      const ivory = new THREE.MeshStandardMaterial({ color: 0xe4e0d5, roughness: 0.73, metalness: 0.08 });
      const edge = new THREE.MeshStandardMaterial({ color: 0xaaa99f, roughness: 0.49, metalness: 0.55 });
      const silver = new THREE.MeshStandardMaterial({ color: 0xc7c8c0, roughness: 0.38, metalness: 0.75 });
      const charcoal = new THREE.MeshStandardMaterial({ color: 0x252827, roughness: 0.78 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x111615, roughness: 0.63 });
      const red = new THREE.MeshStandardMaterial({ color: 0xb4513a, roughness: 0.94 });
      const paper = new THREE.MeshStandardMaterial({ color: 0xf8f3e5, roughness: 1 });
      const glass = new THREE.MeshStandardMaterial({ color: 0x263d3b, roughness: 0.12, metalness: 0.8 });
      const textures = new Set<InstanceType<typeof THREE.Texture>>();

      function box(w: number, h: number, d: number, material: InstanceType<typeof THREE.Material>, x = 0, y = 0, z = 0, parent: InstanceType<typeof THREE.Object3D> = objects) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
      }
      function cylinder(radius: number, depth: number, material: InstanceType<typeof THREE.Material>, x: number, y: number, z: number, parent: InstanceType<typeof THREE.Object3D> = objects) {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 48), material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
      }
      function canvasTexture(width: number, height: number, paint: (context: CanvasRenderingContext2D) => void) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) return null;
        paint(context);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        textures.add(texture);
        return texture;
      }

      // A modest laptop, with an editorial research notebook on its screen.
      const laptop = new THREE.Group();
      laptop.position.set(-0.6, 0.04, -0.6);
      laptop.rotation.y = -0.08;
      objects.add(laptop);
      box(3.6, 0.16, 2.35, ivory, 0, 0.08, 0.15, laptop);
      box(3.45, 0.025, 2.2, silver, 0, 0.171, 0.15, laptop);
      box(1.03, 0.009, 0.58, edge, 0, 0.19, 0.8, laptop);
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 11; col++) {
          box(0.231, 0.022, 0.17, charcoal, -1.35 + col * 0.27, 0.198, -0.54 + row * 0.25, laptop);
        }
      }
      box(1.45, 0.02, 0.13, charcoal, 0, 0.198, 0.34, laptop);
      const lid = new THREE.Group();
      lid.position.set(0, 0.2, -0.98);
      lid.rotation.x = -0.14;
      laptop.add(lid);
      box(3.6, 2.36, 0.115, ivory, 0, 1.18, 0, lid);
      box(3.35, 2.12, 0.017, charcoal, 0, 1.21, 0.068, lid);
      const screenTexture = canvasTexture(1200, 760, (ctx) => {
        ctx.fillStyle = "#282e2b";
        ctx.fillRect(0, 0, 1200, 760);
        ctx.fillStyle = "#c8cbbd";
        ctx.font = "20px monospace";
        ctx.fillText("J. GUO  /  RESEARCH NOTES", 72, 77);
        ctx.strokeStyle = "#626a5f";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(72, 111); ctx.lineTo(1128, 111); ctx.stroke();
        ctx.fillStyle = "#f2eee0";
        ctx.font = "italic 108px Georgia, serif";
        ctx.fillText("Look a little", 70, 270);
        ctx.fillText("closer.", 70, 384);
        ctx.font = "23px monospace";
        ctx.fillStyle = "#b5c0ad";
        ctx.fillText("COMPUTER VISION", 76, 585);
        ctx.fillStyle = "#bd6b51";
        ctx.fillRect(76, 625, 10, 10);
        ctx.fillStyle = "#b5c0ad";
        ctx.font = "18px monospace";
        ctx.fillText("LEHIGH UNIVERSITY", 104, 636);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#798678";
        ctx.beginPath(); ctx.arc(960, 526, 98, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(960, 526, 68, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(839, 526); ctx.lineTo(1081, 526); ctx.moveTo(960, 405); ctx.lineTo(960, 647); ctx.stroke();
      });
      let laptopScreen: InstanceType<typeof THREE.Mesh> | undefined;
      if (screenTexture) {
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.22, 2.02), new THREE.MeshBasicMaterial({ map: screenTexture }));
        screen.position.set(0, 1.21, 0.080);
        lid.add(screen);
        laptopScreen = screen;
      }
      const webcam = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), dark);
      webcam.position.set(0, 2.31, 0.065);
      lid.add(webcam);

      // A little rangefinder camera. Its lens faces forward, not up.
      const cameraObject = new THREE.Group();
      cameraObject.position.set(1.63, 0.04, 1.05);
      cameraObject.rotation.y = -0.27;
      objects.add(cameraObject);
      box(1.75, 1.05, 0.72, charcoal, 0, 0.57, 0, cameraObject);
      box(1.77, 0.2, 0.75, silver, 0, 1.02, 0, cameraObject);
      box(1.77, 0.11, 0.75, silver, 0, 0.1, 0, cameraObject);
      box(0.28, 0.83, 0.075, dark, 0.66, 0.56, 0.4, cameraObject);
      box(0.29, 0.17, 0.02, glass, -0.55, 0.87, 0.39, cameraObject);
      box(0.2, 0.12, 0.025, dark, -0.53, 0.87, 0.405, cameraObject);
      const badge = cylinder(0.06, 0.015, red, -0.58, 0.63, 0.385, cameraObject);
      badge.rotation.x = Math.PI / 2;
      const lensBack = cylinder(0.49, 0.13, silver, 0.1, 0.57, 0.4, cameraObject);
      lensBack.rotation.x = Math.PI / 2;
      const lens = cylinder(0.425, 0.53, dark, 0.1, 0.57, 0.66, cameraObject);
      lens.rotation.x = Math.PI / 2;
      for (let i = 0; i < 6; i++) {
        const ring = cylinder(0.434, 0.024, i === 3 ? silver : charcoal, 0.1, 0.57, 0.47 + i * 0.071, cameraObject);
        ring.rotation.x = Math.PI / 2;
      }
      const lensFace = cylinder(0.345, 0.015, glass, 0.1, 0.57, 0.94, cameraObject);
      lensFace.rotation.x = Math.PI / 2;
      const lensCore = cylinder(0.18, 0.018, dark, 0.1, 0.57, 0.952, cameraObject);
      lensCore.rotation.x = Math.PI / 2;
      cylinder(0.13, 0.08, dark, 0.5, 1.16, 0.01, cameraObject);
      cylinder(0.09, 0.07, silver, 0.69, 1.16, 0.16, cameraObject);
      cylinder(0.18, 0.08, silver, -0.5, 1.16, -0.03, cameraObject);

      // Cloth-bound notebook and its exposed paper edges.
      const book = new THREE.Group();
      book.position.set(-1.7, 0.03, 1.55);
      book.rotation.y = -0.29;
      objects.add(book);
      box(1.7, 0.06, 1.15, red, 0, 0.04, 0, book);
      box(1.61, 0.17, 1.05, paper, 0.025, 0.14, 0, book);
      box(1.7, 0.065, 1.15, red, 0, 0.26, 0, book);
      box(0.065, 0.26, 1.15, red, -0.82, 0.14, 0, book);
      const bookTexture = canvasTexture(800, 540, (ctx) => {
        ctx.fillStyle = "#b4513a";
        ctx.fillRect(0, 0, 800, 540);
        ctx.fillStyle = "#f4e7d3";
        ctx.font = "44px Georgia, serif";
        ctx.fillText("Field notes", 82, 190);
        ctx.font = "19px monospace";
        ctx.fillText("JIAWEI GUO", 85, 408);
        ctx.strokeStyle = "#d39478";
        ctx.beginPath(); ctx.moveTo(85, 235); ctx.lineTo(710, 235); ctx.stroke();
      });
      if (bookTexture) {
        const cover = new THREE.Mesh(new THREE.PlaneGeometry(1.61, 1.06), new THREE.MeshBasicMaterial({ map: bookTexture }));
        cover.rotation.x = -Math.PI / 2;
        cover.position.set(0, 0.297, 0);
        book.add(cover);
      }
      for (let i = 0; i < 4; i++) box(1.58, 0.005, 0.003, ivory, 0.025, 0.085 + i * 0.035, 0.529, book);

      // A small cup at the back of the desk.
      const cup = new THREE.Group();
      cup.position.set(1.95, 0.02, -1.15);
      objects.add(cup);
      const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.28, 0.64, 48), ivory);
      cupBody.position.y = 0.34;
      cupBody.castShadow = true;
      cup.add(cupBody);
      const coffee = cylinder(0.295, 0.018, new THREE.MeshStandardMaterial({ color: 0x44372b, roughness: 0.35 }), 0, 0.665, 0, cup);
      coffee.castShadow = false;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.028, 12, 48), ivory);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.674;
      cup.add(rim);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.048, 12, 32), ivory);
      handle.position.set(0.39, 0.39, 0);
      handle.castShadow = true;
      cup.add(handle);

      let visible = true;
      let frame = 0;
      let pointerX = 0;
      let pointerY = 0;
      let scrollProgress = 0;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      const loader = new THREE.TextureLoader();
      const albumWidth = 1.68;
      const albumDepth = 1.24;
      const album = new THREE.Group();
      album.position.set(-0.68, 0.035, 1.85);
      album.rotation.y = 0.13;
      objects.add(album);
      const albumRestY = album.position.y;
      const albumCloth = new THREE.MeshStandardMaterial({ color: 0x67705a, roughness: 0.96 });
      const albumCover = new THREE.MeshStandardMaterial({ color: 0xe9e1ce, roughness: 0.94 });
      const albumPaper = new THREE.MeshStandardMaterial({ color: 0xf7f0df, roughness: 1, side: THREE.DoubleSide });
      box(albumWidth + 0.06, 0.045, albumDepth + 0.055, albumCloth, albumWidth / 2, 0.025, 0, album);
      box(albumWidth - 0.035, 0.17, albumDepth - 0.035, albumPaper, albumWidth / 2 + 0.015, 0.135, 0, album);
      const spine = cylinder(0.075, albumDepth + 0.035, red, 0, 0.14, 0, album);
      spine.rotation.x = Math.PI / 2;
      for (let index = 0; index < 8; index++) {
        box(albumWidth - 0.07, 0.004, 0.003, albumCover, albumWidth / 2 + 0.02, 0.065 + index * 0.019, albumDepth / 2 - 0.014, album);
      }
      const loadPhoto = (url: string) => {
        const texture = loader.load(url, () => { if (!cancelled) requestRender(); }, undefined, () => undefined);
        textures.add(texture);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        return texture;
      };
      // Each visible side of the cover and turning leaves has its own photo.
      const photoMaterials = albumSequence.map(({ url }) => new THREE.MeshBasicMaterial({ map: loadPhoto(url), toneMapped: false }));
      const photoWidth = 1.4;
      const photoHeight = 0.93;
      // The last page is a live HTML Gallery, projected onto this dark surface.
      const galleryPage = new THREE.Mesh(new THREE.PlaneGeometry(photoWidth, photoHeight), new THREE.MeshBasicMaterial({ color: 0x080909, toneMapped: false }));
      galleryPage.rotation.x = -Math.PI / 2;
      galleryPage.position.set(albumWidth / 2, 0.223, 0);
      album.add(galleryPage);

      // The cover really turns around the cloth spine. Its offset from the
      // hinge lets it settle beside the paper block rather than above it.
      const coverHinge = new THREE.Group();
      coverHinge.position.set(0, 0.14, 0);
      album.add(coverHinge);
      box(albumWidth + 0.06, 0.052, albumDepth + 0.055, albumCover, albumWidth / 2, 0.105, 0, coverHinge);
      box(0.09, 0.056, albumDepth + 0.06, red, 0.015, 0.105, 0, coverHinge);
      const coverPhoto = new THREE.Mesh(new THREE.PlaneGeometry(photoWidth, photoHeight), photoMaterials[0]);
      coverPhoto.rotation.x = -Math.PI / 2;
      coverPhoto.position.set(albumWidth / 2 + 0.02, 0.133, -0.05);
      coverHinge.add(coverPhoto);
      const coverTitleTexture = canvasTexture(1024, 120, (context) => {
        context.fillStyle = "#e9e1ce";
        context.fillRect(0, 0, 1024, 120);
        context.fillStyle = "#46513b";
        context.font = "54px Georgia, serif";
        context.fillText("Photographs", 18, 65);
        context.font = "22px monospace";
        context.textAlign = "right";
        context.fillText("J. GUO", 1000, 65);
      });
      if (coverTitleTexture) {
        const title = new THREE.Mesh(new THREE.PlaneGeometry(1.43, 0.17), new THREE.MeshBasicMaterial({ map: coverTitleTexture, toneMapped: false }));
        title.rotation.x = -Math.PI / 2;
        title.position.set(albumWidth / 2 + 0.02, 0.134, 0.52);
        coverHinge.add(title);
      }
      const insideCover = new THREE.Mesh(new THREE.PlaneGeometry(photoWidth, photoHeight), photoMaterials[1]);
      insideCover.rotation.set(Math.PI / 2, 0, Math.PI);
      insideCover.position.set(albumWidth / 2, 0.076, 0);
      coverHinge.add(insideCover);

      type AlbumLeaf = {
        hinge: InstanceType<typeof THREE.Group>;
        surfaces: Array<{ geometry: InstanceType<typeof THREE.PlaneGeometry>; restingY: number[] }>;
      };
      const leaves: AlbumLeaf[] = [];
      for (let index = 0; index < 2; index++) {
        const hinge = new THREE.Group();
        hinge.position.set(0.025, 0.239 - index * 0.007, 0);
        album.add(hinge);
        const surfaces: AlbumLeaf["surfaces"] = [];
        const addSurface = (width: number, depth: number, offsetY: number, material: InstanceType<typeof THREE.Material>, reverse = false) => {
          const geometry = new THREE.PlaneGeometry(width, depth, 24, 1);
          if (reverse) { geometry.rotateZ(Math.PI); geometry.rotateX(Math.PI / 2); }
          else geometry.rotateX(-Math.PI / 2);
          geometry.translate((albumWidth - 0.05) / 2, offsetY, 0);
          const positions = geometry.getAttribute("position");
          const restingY = Array.from({ length: positions.count }, (_, vertex) => positions.getY(vertex));
          surfaces.push({ geometry, restingY });
          const surface = new THREE.Mesh(geometry, material);
          surface.castShadow = true;
          surface.receiveShadow = true;
          hinge.add(surface);
        };
        addSurface(albumWidth - 0.05, albumDepth - 0.045, 0, albumPaper);
        addSurface(photoWidth, photoHeight, 0.003, photoMaterials[2 + index * 2]);
        addSurface(photoWidth, photoHeight, -0.003, photoMaterials[3 + index * 2], true);
        leaves.push({ hinge, surfaces });
      }
      function turnLeaf(leaf: AlbumLeaf, angle: number) {
        leaf.hinge.rotation.z = angle;
        const curl = Math.sin(angle) * 0.16;
        for (const surface of leaf.surfaces) {
          const positions = surface.geometry.getAttribute("position");
          for (let vertex = 0; vertex < positions.count; vertex++) {
            const along = positions.getX(vertex) / (albumWidth - 0.05);
            positions.setY(vertex, surface.restingY[vertex] + Math.sin(along * Math.PI) * curl);
          }
          positions.needsUpdate = true;
          surface.geometry.computeVertexNormals();
        }
      }
      const albumOverview = new THREE.Object3D();
      albumOverview.position.set(0, 0.22, 0);
      albumOverview.rotation.x = -Math.PI / 2 + 0.28;
      album.add(albumOverview);
      const overviewPosition = new THREE.Vector3();
      const overviewQuaternion = new THREE.Quaternion();
      const smooth = (value: number) => {
        const clamped = Math.max(0, Math.min(1, value));
        return clamped * clamped * (3 - 2 * clamped);
      };
      const galleryDuration = 2650;
      let galleryApproach = 0;
      let startAlbumY = albumRestY;
      let startCoverAngle = 0;
      let startLeafAngles = [0, 0];
      function galleryPhase(value: string) {
        if (host && host.dataset.galleryPhase !== value) host.dataset.galleryPhase = value;
      }
      galleryPhase("closed");

      const transitionDuration = 1150;
      let lastFocus: "desk" | SceneTarget = "desk";
      let transitionStarted = 0;
      let transitionActive = false;
      let settledNotified = false;
      let viewHeight = 6.8;
      let viewAspect = 1.2;
      const startQuaternion = camera.quaternion.clone();
      const startCenter = baseCenter.clone();
      const orbitCenter = baseCenter.clone();
      const orbitNormal = new THREE.Vector3();
      let orbitDistance = basePosition.distanceTo(baseCenter);
      let startOrbitDistance = orbitDistance;
      const destinationPosition = new THREE.Vector3();
      const destinationQuaternion = camera.quaternion.clone();
      let startZoom = camera.zoom;
      let startLidScale = lid.scale.y;
      const focusCenter = new THREE.Vector3();
      const focusNormal = new THREE.Vector3();
      const focusUp = new THREE.Vector3();
      const worldQuaternion = new THREE.Quaternion();
      let reportedScreenBounds: ScreenBounds | null = null;
      let reportedGalleryPage: GalleryPagePlacement | null = null;
      const screenCorners = [
        new THREE.Vector3(-1.61, -1.01, 0), new THREE.Vector3(1.61, -1.01, 0),
        new THREE.Vector3(1.61, 1.01, 0), new THREE.Vector3(-1.61, 1.01, 0),
      ];
      const projectedCorner = new THREE.Vector3();

      function reportScreenBounds(target: "desk" | SceneTarget) {
        if (target !== "research" || transitionActive || !laptopScreen || !host) {
          if (reportedScreenBounds) { reportedScreenBounds = null; screenBoundsRef.current?.(null); }
          return;
        }
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const corner of screenCorners) {
          projectedCorner.copy(corner).applyMatrix4(laptopScreen.matrixWorld).project(camera);
          minX = Math.min(minX, projectedCorner.x); maxX = Math.max(maxX, projectedCorner.x);
          minY = Math.min(minY, projectedCorner.y); maxY = Math.max(maxY, projectedCorner.y);
        }
        const width = host.clientWidth, height = host.clientHeight;
        const bounds = {
          left: (minX + 1) * width / 2,
          top: (1 - maxY) * height / 2,
          width: (maxX - minX) * width / 2,
          height: (maxY - minY) * height / 2,
        };
        if (!reportedScreenBounds || (Object.keys(bounds) as Array<keyof ScreenBounds>).some((key) => Math.abs(bounds[key] - reportedScreenBounds![key]) > 0.5)) {
          reportedScreenBounds = bounds;
          screenBoundsRef.current?.(bounds);
        }
      }

      function reportGalleryPage(target: "desk" | SceneTarget) {
        const uncovered = target === "gallery" && leaves[leaves.length - 1].hinge.rotation.z >= Math.PI / 2;
        if (!uncovered || !host) {
          if (reportedGalleryPage) { reportedGalleryPage = null; galleryPageRef.current?.(null); }
          return;
        }
        const rect = host.getBoundingClientRect();
        const project = (x: number, y: number) => {
          projectedCorner.set(x, y, 0).applyMatrix4(galleryPage.matrixWorld).project(camera);
          return {
            x: rect.left + (projectedCorner.x + 1) * rect.width / 2,
            y: rect.top + (1 - projectedCorner.y) * rect.height / 2,
          };
        };
        const topLeft = project(-photoWidth / 2, photoHeight / 2);
        const topRight = project(photoWidth / 2, photoHeight / 2);
        const bottomLeft = project(-photoWidth / 2, -photoHeight / 2);
        const width = Math.max(1, window.innerWidth), height = Math.max(1, window.innerHeight);
        const placement = {
          a: (topRight.x - topLeft.x) / width,
          b: (topRight.y - topLeft.y) / width,
          c: (bottomLeft.x - topLeft.x) / height,
          d: (bottomLeft.y - topLeft.y) / height,
          e: topLeft.x,
          f: topLeft.y,
        };
        const scale = { a: width, b: width, c: height, d: height, e: 1, f: 1 };
        if (!reportedGalleryPage || (Object.keys(placement) as Array<keyof GalleryPagePlacement>).some((key) => Math.abs(placement[key] - reportedGalleryPage![key]) * scale[key] > 0.5)) {
          reportedGalleryPage = placement;
          galleryPageRef.current?.(placement);
        }
      }

      function canonicalFocus(): "desk" | SceneTarget {
        return focusRef.current === "camera" ? "gallery" : focusRef.current;
      }

      function closeupZoom(target: "desk" | SceneTarget) {
        if (target === "desk") return 1;
        if (target === "research") {
          // Leave the physical bezel and a little breathing room around the
          // actual screen; the HTML research interface is projected into it.
          return Math.min(viewHeight * 0.72 / (2.02 * lid.scale.y), viewHeight * viewAspect * 0.83 / 3.22);
        }
        // Keep the open book framed while its live Gallery page expands in HTML.
        return Math.min(viewHeight * 0.74 / 2.6, viewHeight * viewAspect * 0.88 / (albumWidth * 2 + 0.28));
      }

      function researchLidScale(target: "desk" | SceneTarget) {
        if (target !== "research" || viewAspect >= 1.2) return 1;
        // A responsive physical monitor: its lid becomes portrait-shaped on a
        // phone, so the interface can remain legible inside the actual bezel.
        return Math.min(3.2, Math.max(1, (3.22 / 2.02) / (viewAspect * 0.83 / 0.72)));
      }

      function updateDestination(target: "desk" | SceneTarget) {
        if (target === "desk") {
          destinationPosition.copy(basePosition);
          destinationQuaternion.copy(baseQuaternion);
          return;
        }
        scene.updateMatrixWorld(true);
        const focalMesh = target === "research" ? laptopScreen : galleryPage;
        if (!focalMesh) return;
        if (target === "gallery") {
          albumOverview.getWorldPosition(overviewPosition);
          albumOverview.getWorldQuaternion(overviewQuaternion);
          focusCenter.copy(overviewPosition);
          worldQuaternion.copy(overviewQuaternion);
        } else {
          focalMesh.getWorldPosition(focusCenter);
          focalMesh.getWorldQuaternion(worldQuaternion);
        }
        focusNormal.set(0, 0, 1).applyQuaternion(worldQuaternion).normalize();
        focusUp.set(0, 1, 0).applyQuaternion(worldQuaternion).normalize();
        destinationPosition.copy(focusCenter).addScaledVector(focusNormal, 12);
        framingCamera.position.copy(destinationPosition);
        framingCamera.up.copy(focusUp);
        framingCamera.lookAt(focusCenter);
        destinationQuaternion.copy(framingCamera.quaternion);
      }

      function render(now = performance.now()) {
        frame = 0;
        if (cancelled || !host || !visible || document.hidden) return;
        const focusView = canonicalFocus();
        if (focusView !== lastFocus) {
          lastFocus = focusView;
          startQuaternion.copy(camera.quaternion);
          orbitNormal.set(0, 0, 1).applyQuaternion(camera.quaternion);
          startCenter.copy(camera.position).addScaledVector(orbitNormal, -orbitDistance);
          startOrbitDistance = orbitDistance;
          startZoom = camera.zoom;
          startLidScale = lid.scale.y;
          startAlbumY = album.position.y;
          startCoverAngle = coverHinge.rotation.z;
          startLeafAngles = leaves.map((leaf) => leaf.hinge.rotation.z);
          transitionStarted = now;
          transitionActive = true;
          settledNotified = false;
          host.style.cursor = "default";
          updateDestination(focusView);
        }

        const duration = focusView === "gallery" ? galleryDuration : transitionDuration;
        const rawProgress = transitionActive ? Math.min(1, (now - transitionStarted) / duration) : 1;
        const progress = reducedMotion.matches ? 1 : rawProgress;
        const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
        if (focusView === "gallery") {
          const elapsed = progress * galleryDuration;
          galleryApproach = smooth(elapsed / 850);
          album.position.y = startAlbumY + (1.45 - startAlbumY) * galleryApproach;
          coverHinge.rotation.z = startCoverAngle + (Math.PI - startCoverAngle) * smooth((elapsed - 650) / 900);
          leaves.forEach((leaf, index) => turnLeaf(leaf, startLeafAngles[index] + (Math.PI - startLeafAngles[index]) * smooth((elapsed - 1050 - index * 250) / 850)));
          galleryPhase(elapsed < 650 ? "approaching" : leaves[leaves.length - 1].hinge.rotation.z < Math.PI / 2 ? "opening" : elapsed < galleryDuration ? "gallery-page" : "open");
        } else {
          album.position.y = startAlbumY + (albumRestY - startAlbumY) * eased;
          coverHinge.rotation.z = startCoverAngle * (1 - eased);
          leaves.forEach((leaf, index) => turnLeaf(leaf, startLeafAngles[index] * (1 - eased)));
          galleryPhase(progress < 1 && startCoverAngle > 0 ? "closing" : "closed");
        }
        const targetLidScale = researchLidScale(focusView);
        lid.scale.y = transitionActive ? startLidScale + (targetLidScale - startLidScale) * eased : targetLidScale;
        // The focus point follows the screen's changing center during the
        // portrait morph, while its normal stays perpendicular to the camera.
        updateDestination(focusView);
        const targetZoom = closeupZoom(focusView);
        if (transitionActive) {
          const cameraProgress = focusView === "gallery" ? galleryApproach : eased;
          camera.quaternion.slerpQuaternions(startQuaternion, destinationQuaternion, cameraProgress);
          orbitCenter.lerpVectors(startCenter, focusView === "desk" ? baseCenter : focusCenter, cameraProgress);
          orbitDistance = startOrbitDistance + ((focusView === "desk" ? basePosition.distanceTo(baseCenter) : 12) - startOrbitDistance) * cameraProgress;
          orbitNormal.set(0, 0, 1).applyQuaternion(camera.quaternion);
          camera.position.copy(orbitCenter).addScaledVector(orbitNormal, orbitDistance);
          camera.zoom = focusView === "gallery"
            ? startZoom * (targetZoom / startZoom) ** galleryApproach
            : startZoom + (targetZoom - startZoom) * eased;
          if (progress === 1) transitionActive = false;
        } else {
          // Keep the projected interface aligned after a responsive resize.
          camera.zoom = targetZoom;
          if (focusView !== "desk") {
            camera.position.copy(destinationPosition);
            camera.quaternion.copy(destinationQuaternion);
          }
        }

        let unsettled = 0;
        if (focusView === "desk" && !transitionActive) {
          const nextY = -0.16 + (reducedMotion.matches ? 0 : pointerX * 0.08 + scrollProgress * 0.23);
          const nextX = reducedMotion.matches ? 0 : pointerY * 0.025;
          const easing = reducedMotion.matches ? 1 : 0.1;
          objects.rotation.y += (nextY - objects.rotation.y) * easing;
          objects.rotation.x += (nextX - objects.rotation.x) * easing;
          unsettled = Math.abs(nextY - objects.rotation.y) + Math.abs(nextX - objects.rotation.x);
        }
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        renderer.render(scene, camera);
        reportScreenBounds(focusView);
        reportGalleryPage(focusView);

        if (!transitionActive && !settledNotified) {
          settledNotified = true;
          setSettled(true);
          if (focusView !== "desk") settledRef.current?.(focusView);
        }
        if (transitionActive || unsettled > 0.0003) requestRender();
      }
      function requestRender() {
        if (!frame && visible && !document.hidden && !cancelled) frame = window.requestAnimationFrame(render);
      }
      function resize() {
        if (!host) return;
        const width = host.clientWidth;
        const height = host.clientHeight;
        if (!width || !height) return;
        viewAspect = width / height;
        viewHeight = viewAspect < 0.9 ? 6.5 : 6.8;
        camera.left = -viewHeight * viewAspect / 2;
        camera.right = viewHeight * viewAspect / 2;
        camera.top = viewHeight / 2;
        camera.bottom = -viewHeight / 2;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        // Repaint the resized drawing buffer in the same frame. The gallery
        // stage grows to the viewport, so waiting one frame here would flash.
        if (frame) { cancelAnimationFrame(frame); frame = 0; }
        render();
      }
      const raycaster = new THREE.Raycaster();
      const hitPoint = new THREE.Vector2();
      // A camera-facing picking surface keeps the album easy to select on
      // touch screens without changing its physical size on the desk.
      const photoHitTarget = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
      );
      photoHitTarget.visible = false;
      scene.add(photoHitTarget);
      const coarsePointer = window.matchMedia("(pointer: coarse)");
      const targets = new Map<InstanceType<typeof THREE.Object3D>, SceneTarget>([
        [laptop, "research"], [cameraObject, "gallery"],
        [album, "gallery"],
      ]);
      const targetObjects = [...targets.keys()];
      let pointerStart: { x: number; y: number; id: number; time: number } | null = null;
      function pick(event: PointerEvent): SceneTarget | null {
        if (!host || canonicalFocus() !== "desk" || !selectRef.current) return null;
        const rect = host.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        hitPoint.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
        scene.updateMatrixWorld(true);
        camera.updateMatrixWorld();
        raycaster.setFromCamera(hitPoint, camera);
        if (galleryPage) {
          galleryPage.getWorldPosition(photoHitTarget.position);
          photoHitTarget.quaternion.copy(camera.quaternion);
          const minimumPixels = coarsePointer.matches || event.pointerType === "touch" ? 72 : 64;
          const side = viewHeight / camera.zoom * minimumPixels / rect.height;
          photoHitTarget.scale.set(side, side, 1);
          photoHitTarget.updateMatrixWorld(true);
          // Prefer the album in its immediate vicinity; the generous laptop
          // geometry remains clickable everywhere outside this small hotspot.
          if (raycaster.intersectObject(photoHitTarget, false).length) return "gallery";
        }
        for (const hit of raycaster.intersectObjects(targetObjects, true)) {
          let object: InstanceType<typeof THREE.Object3D> | null = hit.object;
          while (object) {
            const target = targets.get(object);
            if (target) return target;
            object = object.parent;
          }
        }
        return null;
      }
      function move(event: PointerEvent) {
        if (!host || canonicalFocus() !== "desk") return;
        if (event.pointerType !== "touch") host.style.cursor = pick(event) ? "pointer" : "default";
        if (reducedMotion.matches || event.pointerType === "touch") return;
        const rect = host.getBoundingClientRect();
        pointerX = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
        pointerY = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
        requestRender();
      }
      function pointerDown(event: PointerEvent) {
        if (event.button !== 0) return;
        pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId, time: performance.now() };
      }
      function pointerUp(event: PointerEvent) {
        const start = pointerStart;
        pointerStart = null;
        if (!start || start.id !== event.pointerId || performance.now() - start.time > 900 || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) return;
        const selected = pick(event);
        if (selected) selectRef.current?.(selected);
      }
      function pointerCancel() { pointerStart = null; }
      function leave() { pointerX = 0; pointerY = 0; if (host) host.style.cursor = "default"; requestRender(); }
      function scroll() {
        if (!host || reducedMotion.matches) return;
        const top = host.getBoundingClientRect().top + window.scrollY;
        scrollProgress = Math.max(0, Math.min(1, (window.scrollY - top + window.innerHeight * 0.1) / window.innerHeight));
        requestRender();
      }
      function visibility() {
        if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
        else requestRender();
      }
      function motionChanged() { scroll(); requestRender(); }
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (!visible && frame) { cancelAnimationFrame(frame); frame = 0; }
        else requestRender();
      }, { rootMargin: "80px" });
      observer.observe(host);
      host.addEventListener("pointermove", move, { passive: true });
      host.addEventListener("pointerdown", pointerDown, { passive: true });
      host.addEventListener("pointerup", pointerUp, { passive: true });
      host.addEventListener("pointercancel", pointerCancel, { passive: true });
      host.addEventListener("pointerleave", leave, { passive: true });
      window.addEventListener("scroll", scroll, { passive: true });
      document.addEventListener("visibilitychange", visibility);
      reducedMotion.addEventListener("change", motionChanged);
      renderRequestRef.current = requestRender;
      resize();
      scroll();
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      render();
      setReady(true);

      teardown = () => {
        screenBoundsRef.current?.(null);
        galleryPageRef.current?.(null);
        if (renderRequestRef.current === requestRender) renderRequestRef.current = null;
        if (frame) cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        observer.disconnect();
        host.removeEventListener("pointermove", move);
        host.removeEventListener("pointerdown", pointerDown);
        host.removeEventListener("pointerup", pointerUp);
        host.removeEventListener("pointercancel", pointerCancel);
        host.removeEventListener("pointerleave", leave);
        window.removeEventListener("scroll", scroll);
        document.removeEventListener("visibilitychange", visibility);
        reducedMotion.removeEventListener("change", motionChanged);
        const materials = new Set<InstanceType<typeof THREE.Material>>();
        const geometries = new Set<InstanceType<typeof THREE.BufferGeometry>>();
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            geometries.add(object.geometry);
            const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
            meshMaterials.forEach((material) => materials.add(material));
          }
        });
        textures.forEach((texture) => texture.dispose());
        geometries.forEach((geometry) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
    }

    mount().catch(() => {
      // The illustrated fallback is the complete non-WebGL experience.
      if (!cancelled) setReady(false);
      teardown?.();
    });
    return () => { cancelled = true; teardown?.(); };
  }, []);

  return (
    <div className={`paper-desk ${className}`.trim()} ref={hostRef} role="img" aria-label="A small workspace with a laptop, camera, field notebook and a photo album" data-focus={focus === "camera" ? "gallery" : focus} data-ready={ready} data-settled={settled} data-album-photos={JSON.stringify(albumSequence.map(({ url }) => url))} style={{ position: "relative", width: "100%", height: immersive ? "100%" : undefined, aspectRatio: immersive ? undefined : "1.2" }}>
      <img src="/desk-scene-fallback.svg" alt="" aria-hidden="true" width="720" height="600" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", visibility: ready ? "hidden" : "visible" }} />
    </div>
  );
}
