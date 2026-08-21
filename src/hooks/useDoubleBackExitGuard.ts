import { useEffect, useRef } from "react";
import {
  hasActiveBackNavigationLayer,
  wasBackNavigationLayerClosedRecently,
} from "./useBackNavigationLayer";

type DoubleBackExitGuardOptions = {
  isActive: boolean;
  onFirstBack: () => void;
  onReset?: () => void;
  timeoutMs?: number;
};

export const useDoubleBackExitGuard = ({
  isActive,
  onFirstBack,
  onReset,
  timeoutMs = 2000,
}: DoubleBackExitGuardOptions) => {
  const lastBackAtRef = useRef(0);
  const resetTimeoutRef = useRef<number | null>(null);
  const onFirstBackRef = useRef(onFirstBack);
  const onResetRef = useRef(onReset);
  const timeoutMsRef = useRef(timeoutMs);

  useEffect(() => {
    onFirstBackRef.current = onFirstBack;
  }, [onFirstBack]);

  useEffect(() => {
    onResetRef.current = onReset;
  }, [onReset]);

  useEffect(() => {
    timeoutMsRef.current = timeoutMs;
  }, [timeoutMs]);

  useEffect(() => {
    if (!isActive || typeof window === "undefined") return;

    const guardId = `booklog-exit-${Date.now()}`;

    const clearResetTimer = () => {
      if (resetTimeoutRef.current === null) return;

      window.clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    };

    const resetFirstBack = () => {
      lastBackAtRef.current = 0;
      clearResetTimer();
      onResetRef.current?.();
    };

    const pushExitGuard = () => {
      window.history.pushState(
        {
          ...(window.history.state ?? {}),
          booklogExitGuard: guardId,
        },
        "",
      );
    };

    pushExitGuard();

    const handlePopState = () => {
      if (
        hasActiveBackNavigationLayer() ||
        wasBackNavigationLayerClosedRecently()
      ) {
        return;
      }

      const now = Date.now();
      const isSecondBack =
        lastBackAtRef.current > 0 &&
        now - lastBackAtRef.current <= timeoutMsRef.current;

      if (isSecondBack) {
        resetFirstBack();
        window.removeEventListener("popstate", handlePopState);
        window.history.back();
        return;
      }

      lastBackAtRef.current = now;
      onFirstBackRef.current();
      pushExitGuard();
      clearResetTimer();
      resetTimeoutRef.current = window.setTimeout(() => {
        resetFirstBack();
      }, timeoutMsRef.current);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      clearResetTimer();
    };
  }, [isActive]);
};
