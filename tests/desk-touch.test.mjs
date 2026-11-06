import assert from "node:assert/strict";
import test from "node:test";
import { installDeskTouch } from "../app/components/desk-touch.ts";

class SceneHost extends EventTarget {
  style = { touchAction: "pan-y" };
  ownerDocument = new EventTarget();
  captured = new Set();
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
}

function pointer(target, type, { id = 1, x = 0, y = 0, pointerType = "touch", button = 0, isPrimary = true } = {}) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: id }, pointerType: { value: pointerType }, button: { value: button },
    isPrimary: { value: isPrimary },
    clientX: { value: x }, clientY: { value: y },
  });
  target.dispatchEvent(event);
  return event;
}

function setup() {
  const host = new SceneHost();
  const taps = [], drags = [];
  let clock = 0, enabled = true, endings = 0;
  const dispose = installDeskTouch(host, {
    enabled: () => enabled,
    now: () => clock,
    onTap: (event) => taps.push(event.pointerId),
    onDrag: (dx, dy) => drags.push([dx, dy]),
    onDragEnd: () => endings++,
  });
  return { host, taps, drags, dispose, tick: (ms) => { clock += ms; }, disable: () => { enabled = false; }, endings: () => endings };
}

test("a deliberate touch tap activates an object, while mouse input is left alone", () => {
  const scene = setup();
  const down = pointer(scene.host, "pointerdown", { x: 30, y: 50 });
  assert.equal(down.defaultPrevented, true);
  assert.equal(scene.host.hasPointerCapture(1), true);
  scene.tick(120);
  pointer(scene.host, "pointerup", { x: 33, y: 52 });
  assert.deepEqual(scene.taps, [1]);
  assert.deepEqual(scene.drags, []);
  assert.equal(scene.host.hasPointerCapture(1), false);
  const mouseDown = pointer(scene.host, "pointerdown", { pointerType: "mouse" });
  pointer(scene.host, "pointerup", { pointerType: "mouse" });
  assert.equal(mouseDown.defaultPrevented, false);
  assert.deepEqual(scene.taps, [1]);
  scene.dispose();
});

test("dragging responds immediately and never taps even when the finger returns to its start", () => {
  const scene = setup();
  pointer(scene.host, "pointerdown", { x: 100, y: 100 });
  pointer(scene.host, "pointermove", { x: 124, y: 110 });
  assert.deepEqual(scene.drags, [[24, 10]]);
  pointer(scene.host, "pointermove", { x: 100, y: 100 });
  pointer(scene.host, "pointerup", { x: 100, y: 100 });
  assert.deepEqual(scene.drags, [[24, 10], [-24, -10]]);
  assert.deepEqual(scene.taps, []);
  assert.equal(scene.endings(), 1);
  scene.dispose();
});

test("a last coalesced movement is treated as a drag rather than an accidental tap", () => {
  const scene = setup();
  pointer(scene.host, "pointerdown", {});
  pointer(scene.host, "pointerup", { x: 30, y: 15 });
  assert.deepEqual(scene.taps, []);
  assert.deepEqual(scene.drags, [[30, 15]]);
  scene.dispose();
});

test("two fingers cancel the whole gesture until both are released", () => {
  const scene = setup();
  pointer(scene.host, "pointerdown", { id: 1 });
  pointer(scene.host.ownerDocument, "pointerdown", { id: 2 });
  pointer(scene.host, "pointermove", { id: 1, x: 30 });
  pointer(scene.host.ownerDocument, "pointerup", { id: 2 });
  pointer(scene.host, "pointermove", { id: 1, x: 50 });
  pointer(scene.host.ownerDocument, "pointerup", { id: 1, x: 50 });
  assert.deepEqual(scene.drags, []);
  assert.deepEqual(scene.taps, []);
  pointer(scene.host, "pointerdown", { id: 3 });
  pointer(scene.host, "pointerup", { id: 3 });
  assert.deepEqual(scene.taps, [3]);
  scene.dispose();
});

test("cancellation, lost capture, and disabled interactions cannot leave a tap armed", () => {
  for (const reason of ["pointercancel", "lostpointercapture", "disabled"]) {
    const scene = setup();
    pointer(scene.host, "pointerdown", {});
    pointer(scene.host, "pointermove", { x: 20 });
    if (reason === "disabled") scene.disable();
    else pointer(scene.host, reason, { x: 20 });
    pointer(scene.host.ownerDocument, "pointerup", { x: 20 });
    assert.deepEqual(scene.taps, [], reason);
    assert.equal(scene.endings(), 1, reason);
    assert.equal(scene.host.captured.size, 0, reason);
    scene.dispose();
  }
});

test("a second finger arriving from outside the scene cannot activate an object", () => {
  const scene = setup();
  pointer(scene.host, "pointerdown", { id: 2, isPrimary: false });
  pointer(scene.host, "pointermove", { id: 2, x: 40, isPrimary: false });
  pointer(scene.host, "pointerup", { id: 2, x: 40, isPrimary: false });
  assert.deepEqual(scene.taps, []);
  assert.deepEqual(scene.drags, []);
  pointer(scene.host, "pointerdown", { id: 3 });
  pointer(scene.host, "pointerup", { id: 3 });
  assert.deepEqual(scene.taps, [3]);
  scene.dispose();
});

test("a long press does not open an object, and a pen can deliberately tap", () => {
  const scene = setup();
  pointer(scene.host, "pointerdown", {});
  scene.tick(1000);
  pointer(scene.host, "pointerup", {});
  assert.deepEqual(scene.taps, []);
  pointer(scene.host, "pointerdown", { id: 2, pointerType: "pen" });
  scene.tick(80);
  pointer(scene.host, "pointerup", { id: 2, pointerType: "pen" });
  assert.deepEqual(scene.taps, [2]);
  scene.dispose();
});

test("cleanup releases capture, restores browser styles, and removes host and document handlers", () => {
  const scene = setup();
  pointer(scene.host, "pointerdown", {});
  pointer(scene.host, "pointermove", { x: 20 });
  assert.equal(scene.host.style.touchAction, "none");
  scene.dispose();
  scene.dispose();
  assert.equal(scene.host.style.touchAction, "pan-y");
  assert.equal(scene.host.captured.size, 0);
  assert.equal(scene.endings(), 1);
  const laterDown = pointer(scene.host, "pointerdown", { id: 2 });
  pointer(scene.host.ownerDocument, "pointermove", { id: 2, x: 60 });
  pointer(scene.host.ownerDocument, "pointerup", { id: 2, x: 60 });
  assert.equal(laterDown.defaultPrevented, false);
  assert.deepEqual(scene.drags, [[20, 0]]);
  assert.deepEqual(scene.taps, []);
});
