"use client";

import { useEffect, useRef } from "react";

type FluidAlbumCanvasProps = {
  title: string;
  firstPhotoUrl?: string;
  onReady: () => void;
  onUnavailable: () => void;
};

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPhoto;
  uniform sampler2D uTitle;
  uniform sampler2D uDensity;
  uniform sampler2D uDye;
  uniform float uPhotoAspect;
  uniform float uViewportAspect;
  uniform float uTime;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p = p * 2.03 + vec2(9.2, 3.7);
      amplitude *= 0.5;
    }
    return value;
  }

  vec2 coverPhotoUv(vec2 uv) {
    vec2 coveredUv = uv;
    if (uViewportAspect > uPhotoAspect) {
      coveredUv.y = (uv.y - 0.5) * (uPhotoAspect / uViewportAspect) + 0.5;
    } else {
      coveredUv.x = (uv.x - 0.5) * (uViewportAspect / uPhotoAspect) + 0.5;
    }
    return coveredUv;
  }

  void main() {
    vec2 uv = vUv;
    vec3 density = texture2D(uDensity, uv).rgb;
    vec3 dye = texture2D(uDye, uv).rgb;
    float fluid = max(density.b, (dye.r + dye.g + dye.b) * 0.34);
    float turbulence = fbm(uv * 4.2 + vec2(uTime * 0.026, -uTime * 0.016));
    float windLine = sin((uv.y * 6.8 + sin(uv.x * 3.5 + uTime * 0.24) * 0.24) * 6.283 + uTime * 0.9);
    float wind = windLine * 0.5 + 0.5;
    float opening = smoothstep(2.0, 4.85, uTime) * 1.54 - 0.5;
    float windEdge = opening - (uv.x - 0.5) + (wind - 0.5) * 0.26 + (turbulence - 0.5) * 0.13 + fluid * 0.36 - 0.24;
    float reveal = smoothstep(-0.1, 0.36, windEdge);
    vec3 photo = texture2D(uPhoto, coverPhotoUv(uv)).rgb;
    vec3 waterBlack = vec3(0.075, 0.079, 0.078) + vec3(0.025, 0.052, 0.052) * turbulence;
    vec3 scene = mix(waterBlack, photo, reveal);

    float letters = texture2D(uTitle, uv).a;
    float titleIn = smoothstep(0.18, 1.18, uTime);
    float titleOut = 1.0 - smoothstep(2.75, 5.25, uTime);
    float inkVariation = clamp(0.40 + fluid * 0.58 + (wind - 0.35) * 0.16 + (turbulence - 0.46) * 0.1, 0.30, 0.74);
    vec3 ink = mix(vec3(0.28, 0.32, 0.31), vec3(0.76, 0.86, 0.83), inkVariation);
    scene = mix(scene, ink, letters * titleIn * titleOut);

    float mist = smoothstep(0.05, 0.5, fluid) * (1.0 - reveal) * 0.11;
    scene += vec3(0.045, 0.09, 0.087) * mist;
    gl_FragColor = vec4(scene, 1.0);
  }
`;

function paintTitle(title: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.clearRect(0, 0, canvas.width, canvas.height);
  let size = 250;
  context.font = `650 ${size}px Georgia, "Times New Roman", serif`;
  const maxWidth = 1740;
  while (context.measureText(title).width > maxWidth && size > 72) {
    size -= 4;
    context.font = `650 ${size}px Georgia, "Times New Roman", serif`;
  }
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#ffffff";
  context.fillText(title, canvas.width / 2, canvas.height / 2 + 4);
  return canvas;
}

export function FluidAlbumCanvas({ title, firstPhotoUrl, onReady, onUnavailable }: FluidAlbumCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The wide WebGL title texture distorts on narrow portrait screens. Use the
    // responsive DOM title there while preserving the cinematic canvas elsewhere.
    if (window.matchMedia("(max-width: 700px) and (orientation: portrait)").matches) {
      onUnavailable();
      return;
    }

    let cancelled = false;
    let frame = 0;
    let disposePointer = () => undefined;
    let resizeObserver: ResizeObserver | undefined;
    let renderer: import("three").WebGLRenderer | undefined;
    let material: import("three").ShaderMaterial | undefined;
    let fluid: { resize: (width: number, height: number) => void; step: (delta: number) => void; addSplat: (x: number, y: number, dx: number, dy: number, options?: { radius?: number; color?: [number, number, number]; dyeColor?: [number, number, number] }) => void; densityTexture: import("three").Texture; dyeTexture: import("three").Texture; dispose: () => void } | undefined;

    async function start() {
      if (!hostRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        onUnavailable();
        return;
      }
      try {
        const THREE = await import("three");
        const { FluidSimulation } = await import("three-fluid-fx");
        if (cancelled || !hostRef.current) return;

        renderer = new THREE.WebGLRenderer({ alpha: false, antialias: false, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        hostRef.current.appendChild(renderer.domElement);

        fluid = new FluidSimulation(renderer, {
          profile: "performance",
          pressureIterations: 7,
          enableDye: true,
          enableVorticity: true,
          curlStrength: 0.72,
          velocityDissipation: 0.982,
          densityDissipation: 0.982,
          dyeDissipation: 0.978,
          bfecc: true,
          reflectWalls: false,
          splatRadius: 0.003,
        });

        const titleTexture = new THREE.CanvasTexture(paintTitle(title));
        titleTexture.colorSpace = THREE.SRGBColorSpace;
        titleTexture.minFilter = THREE.LinearFilter;
        titleTexture.magFilter = THREE.LinearFilter;
        const fallbackPhoto = new THREE.DataTexture(new Uint8Array([12, 15, 15, 255]), 1, 1);
        fallbackPhoto.colorSpace = THREE.SRGBColorSpace;
        fallbackPhoto.needsUpdate = true;
        const updatePhotoAspect = (image: { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number }) => {
          const width = image.naturalWidth || image.width || 1;
          const height = image.naturalHeight || image.height || 1;
          if (material) material.uniforms.uPhotoAspect.value = width / height;
        };
        const photoTexture = firstPhotoUrl
          ? new THREE.TextureLoader().load(firstPhotoUrl, (loadedTexture) => updatePhotoAspect(loadedTexture.image))
          : fallbackPhoto;
        photoTexture.colorSpace = THREE.SRGBColorSpace;
        photoTexture.minFilter = THREE.LinearFilter;
        photoTexture.magFilter = THREE.LinearFilter;

        const scene = new THREE.Scene();
        const camera = new THREE.Camera();
        material = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            uPhoto: { value: photoTexture },
            uTitle: { value: titleTexture },
            uDensity: { value: fluid.densityTexture },
            uDye: { value: fluid.dyeTexture },
            uPhotoAspect: { value: 1 },
            uViewportAspect: { value: 1 },
            uTime: { value: 0 },
          },
        });
        if (photoTexture.image) updatePhotoAspect(photoTexture.image);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(mesh);

        const seedInk = () => {
          if (!fluid) return;
          for (let index = 0; index < 13; index += 1) {
            const y = 0.22 + index * 0.047 + (Math.random() - 0.5) * 0.018;
            fluid.addSplat(0.12 + Math.random() * 0.15, y, 2.5 + Math.random() * 1.5, (Math.random() - 0.5) * 0.24, {
              radius: 0.0016 + Math.random() * 0.0018,
              color: [0.2, 0.34, 0.33],
              dyeColor: [0.028, 0.105, 0.1],
            });
          }
        };
        seedInk();

        const resize = () => {
          if (!hostRef.current || !renderer || !fluid || !material) return;
          const { width, height } = hostRef.current.getBoundingClientRect();
          renderer.setSize(width, height, false);
          fluid.resize(width, height);
          material.uniforms.uViewportAspect.value = width / Math.max(height, 1);
        };
        resize();
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(hostRef.current);

        const startedAt = performance.now();
        let previous = startedAt;
        const render = (now: number) => {
          if (cancelled || !renderer || !fluid) return;
          const seconds = (now - startedAt) / 1000;
          const delta = Math.min((now - previous) / 1000, 1 / 24);
          previous = now;
          if (seconds < 4.9 && Math.floor(seconds * 3.4) !== Math.floor((seconds - delta) * 3.4)) {
            fluid.addSplat(0.1 + Math.random() * 0.23, 0.18 + Math.random() * 0.64, 2.4 + Math.random() * 1.4, (Math.random() - 0.5) * 0.25, {
              radius: 0.0013 + Math.random() * 0.0022,
              color: [0.2, 0.34, 0.33],
              dyeColor: [0.026, 0.1, 0.096],
            });
          }
          fluid.step(delta);
          material.uniforms.uDensity.value = fluid.densityTexture;
          material.uniforms.uDye.value = fluid.dyeTexture;
          material.uniforms.uTime.value = seconds;
          renderer.render(scene, camera);
          frame = window.requestAnimationFrame(render);
        };
        onReady();
        frame = window.requestAnimationFrame(render);

        disposePointer = () => {
          titleTexture.dispose();
          fallbackPhoto.dispose();
          if (photoTexture !== fallbackPhoto) photoTexture.dispose();
          mesh.geometry.dispose();
          material.dispose();
        };
      } catch {
        // The regular title fallback remains visible when WebGL is unavailable.
        if (!cancelled) onUnavailable();
      }
    }
    start();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      disposePointer();
      fluid?.dispose();
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [firstPhotoUrl, onReady, onUnavailable, title]);

  return <div className="album-fluid-canvas" ref={hostRef} aria-hidden="true" />;
}
