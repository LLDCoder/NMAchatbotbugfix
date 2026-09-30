import { useEffect, useState } from "react";

/*
  Whether the primary pointer can actually hover.

  Menus that fly out on hover are unusable on touch: a tap fires a synthetic
  mouseenter, so a hover-only trigger opens the flyout and the following tap
  outside closes it, and a combined hover+click trigger opens on mouseenter then
  immediately toggles shut on the click. Picking one trigger per pointer type
  avoids both, so callers should switch trigger rather than stack triggers.

  Reactive on purpose: a Surface Pro (in the design's device matrix) changes
  pointer type when its keyboard is detached, and a stale value would leave the
  submenu unopenable.
*/
const QUERY = "(hover: hover) and (pointer: fine)";

export function usePointerHasHover(): boolean {
  const [hasHover, setHasHover] = useState(() =>
    typeof window === "undefined" || !window.matchMedia
      ? true
      : window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mql = window.matchMedia(QUERY);
    const onChange = (event: MediaQueryListEvent) => setHasHover(event.matches);

    setHasHover(mql.matches);

    // Safari < 14 only has the deprecated addListener/removeListener pair.
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }

    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return hasHover;
}

export default usePointerHasHover;
