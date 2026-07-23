import { useCallback, useEffect, useRef, type PointerEvent } from "react";

type BookCoverTiltOptions = {
  enabled?: boolean;
};

const isReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const useBookCoverTilt = ({ enabled = true }: BookCoverTiltOptions = {}) => {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef({
    rotateX: 0,
    rotateY: 0,
    pointerX: "50%",
    pointerY: "50%",
    glareOpacity: 0,
  });

  const flushTilt = useCallback(() => {
    frameRef.current = null;

    const element = elementRef.current;
    if (!element) return;

    const pending = pendingRef.current;
    element.style.setProperty("--cover-rotate-x", `${pending.rotateX}deg`);
    element.style.setProperty("--cover-rotate-y", `${pending.rotateY}deg`);
    element.style.setProperty("--cover-pointer-x", pending.pointerX);
    element.style.setProperty("--cover-pointer-y", pending.pointerY);
    element.style.setProperty("--cover-glare-opacity", `${pending.glareOpacity}`);
  }, []);

  const scheduleTilt = useCallback(() => {
    if (frameRef.current !== null) return;

    frameRef.current = window.requestAnimationFrame(flushTilt);
  }, [flushTilt]);

  const resetTilt = useCallback(() => {
    pendingRef.current = {
      rotateX: 0,
      rotateY: 0,
      pointerX: "50%",
      pointerY: "50%",
      glareOpacity: 0,
    };
    scheduleTilt();
  }, [scheduleTilt]);

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!enabled || isReducedMotion()) return;

      const element = elementRef.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
      const y = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);
      const isCoarsePointer = event.pointerType === "touch" || event.pointerType === "pen";
      const maxRotateY = isCoarsePointer ? 7 : 12;
      const maxRotateX = isCoarsePointer ? 4 : 6;

      pendingRef.current = {
        rotateX: (0.5 - y) * maxRotateX * 2,
        rotateY: (x - 0.5) * maxRotateY * 2,
        pointerX: `${Math.round(x * 100)}%`,
        pointerY: `${Math.round(y * 100)}%`,
        glareOpacity: 1,
      };
      scheduleTilt();
    },
    [enabled, scheduleTilt],
  );

  const handlePointerLeave = useCallback(() => {
    resetTilt();
  }, [resetTilt]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  return {
    tiltRef: elementRef,
    tiltHandlers: {
      onPointerMove: handlePointerMove,
      onPointerLeave: handlePointerLeave,
      onPointerCancel: handlePointerLeave,
    },
  };
};
