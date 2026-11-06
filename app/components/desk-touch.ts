export type DeskTouchOptions = {
  enabled: () => boolean;
  onDrag: (dx: number, dy: number) => void;
  onTap: (event: PointerEvent) => void;
  onDragEnd?: () => void;
  now?: () => number;
};

type Gesture = {
  id: number;
  started: number;
  rawX: number;
  rawY: number;
  acceptedX: number;
  acceptedY: number;
  distance: number;
  dragged: boolean;
};

/** One-finger orbit and deliberate taps share the scene, not its reading panes. */
export function installDeskTouch(host: HTMLElement, options: DeskTouchOptions): () => void {
  const now = options.now ?? (() => performance.now());
  const originalTouchAction = host.style.touchAction;
  const pointers = new Set<number>();
  const seenMoves = new WeakSet<Event>();
  const documentTarget = host.ownerDocument;
  let gesture: Gesture | null = null;
  let blocked = false;
  let disposed = false;

  host.style.touchAction = "none";

  const touchPointer = (event: PointerEvent) => event.pointerType === "touch" || event.pointerType === "pen";
  const prevent = (event: PointerEvent) => { if (event.cancelable) event.preventDefault(); };
  const release = (id: number) => {
    try { if (host.hasPointerCapture(id)) host.releasePointerCapture(id); }
    catch { /* The browser may already have released a cancelled pointer. */ }
  };

  function cancel(blockUntilReleased: boolean) {
    const previous = gesture;
    gesture = null;
    if (blockUntilReleased && pointers.size) blocked = true;
    if (previous) {
      release(previous.id);
      if (previous.dragged) options.onDragEnd?.();
    }
  }

  function down(event: PointerEvent) {
    if (disposed || !touchPointer(event) || event.button !== 0) return;
    if (!options.enabled()) { if (pointers.size) cancel(true); return; }
    prevent(event);
    // A document capture listener may already have registered this second finger.
    if (pointers.has(event.pointerId)) return;
    pointers.add(event.pointerId);
    // A non-primary finger can have started outside the scene before this
    // pointer arrived, so it must not arm a scene tap on its own either.
    if (event.isPrimary === false || blocked || pointers.size !== 1) { cancel(true); return; }
    gesture = {
      id: event.pointerId,
      started: now(),
      rawX: event.clientX,
      rawY: event.clientY,
      acceptedX: event.clientX,
      acceptedY: event.clientY,
      distance: 0,
      dragged: false,
    };
    try { host.setPointerCapture(event.pointerId); }
    catch { /* Document listeners still finish a gesture if capture is unavailable. */ }
  }

  function anotherFinger(event: PointerEvent) {
    if (disposed || !touchPointer(event) || event.button !== 0 || !pointers.size || pointers.has(event.pointerId)) return;
    pointers.add(event.pointerId);
    cancel(true);
  }

  function move(event: PointerEvent) {
    if (disposed || !touchPointer(event) || !pointers.has(event.pointerId) || seenMoves.has(event)) return;
    seenMoves.add(event);
    prevent(event);
    if (!options.enabled()) { cancel(true); return; }
    if (blocked || pointers.size !== 1 || !gesture || gesture.id !== event.pointerId) return;
    gesture.distance += Math.hypot(event.clientX - gesture.rawX, event.clientY - gesture.rawY);
    gesture.rawX = event.clientX;
    gesture.rawY = event.clientY;
    if (gesture.distance > 8) gesture.dragged = true;
    if (!gesture.dragged) return;
    const dx = event.clientX - gesture.acceptedX;
    const dy = event.clientY - gesture.acceptedY;
    gesture.acceptedX = event.clientX;
    gesture.acceptedY = event.clientY;
    if (dx || dy) options.onDrag(dx, dy);
  }

  function up(event: PointerEvent) {
    if (disposed || !touchPointer(event) || !pointers.has(event.pointerId)) return;
    // Include the last movement even if the browser coalesced it into pointerup.
    move(event);
    const previous = gesture?.id === event.pointerId ? gesture : null;
    pointers.delete(event.pointerId);
    if (previous) gesture = null;
    prevent(event);
    release(event.pointerId);
    const tapped = previous && !blocked && !previous.dragged && options.enabled() && now() - previous.started < 900;
    if (previous?.dragged) options.onDragEnd?.();
    if (!pointers.size) blocked = false;
    if (tapped) options.onTap(event);
  }

  function pointerCancelled(event: PointerEvent) {
    if (disposed || !touchPointer(event) || !pointers.has(event.pointerId)) return;
    cancel(true);
    pointers.delete(event.pointerId);
    release(event.pointerId);
    if (!pointers.size) blocked = false;
  }

  function lostCapture(event: PointerEvent) {
    if (disposed || !touchPointer(event) || gesture?.id !== event.pointerId) return;
    cancel(true);
  }

  const passiveFalse = { passive: false };
  host.addEventListener("pointerdown", down, passiveFalse);
  host.addEventListener("pointermove", move, passiveFalse);
  host.addEventListener("pointerup", up, passiveFalse);
  host.addEventListener("pointercancel", pointerCancelled, passiveFalse);
  host.addEventListener("lostpointercapture", lostCapture);
  if (documentTarget && documentTarget !== (host as unknown as Document)) {
    documentTarget.addEventListener("pointerdown", anotherFinger, true);
    documentTarget.addEventListener("pointermove", move, { capture: true, passive: false });
    documentTarget.addEventListener("pointerup", up, { capture: true, passive: false });
    documentTarget.addEventListener("pointercancel", pointerCancelled, true);
  }

  return () => {
    if (disposed) return;
    disposed = true;
    cancel(false);
    for (const id of pointers) release(id);
    pointers.clear();
    host.removeEventListener("pointerdown", down);
    host.removeEventListener("pointermove", move);
    host.removeEventListener("pointerup", up);
    host.removeEventListener("pointercancel", pointerCancelled);
    host.removeEventListener("lostpointercapture", lostCapture);
    if (documentTarget && documentTarget !== (host as unknown as Document)) {
      documentTarget.removeEventListener("pointerdown", anotherFinger, true);
      documentTarget.removeEventListener("pointermove", move, true);
      documentTarget.removeEventListener("pointerup", up, true);
      documentTarget.removeEventListener("pointercancel", pointerCancelled, true);
    }
    host.style.touchAction = originalTouchAction;
  };
}
