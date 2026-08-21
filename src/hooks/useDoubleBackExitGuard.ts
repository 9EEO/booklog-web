import { useEffect, useRef } from "react";
import {
  hasActiveBackNavigationLayer,
  wasBackNavigationLayerClosedRecently,
} from "./useBackNavigationLayer";

type DoubleBackExitGuardOptions = {
  isActive: boolean;
  onFirstBack: () => void;
  onReset?: () => void;
  requireAppLikeEnvironment?: boolean;
  timeoutMs?: number;
};

const isAppLikeBackButtonEnvironment = () => {
  if (typeof window === "undefined") return false;

  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };
  const isAndroid = /android/i.test(window.navigator.userAgent);

  return (
    navigatorWithStandalone.standalone === true ||
    isAndroid ||
    document.referrer.startsWith("android-app://") ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches
  );
};

export const useDoubleBackExitGuard = ({
  isActive,
  onFirstBack,
  onReset,
  requireAppLikeEnvironment = true,
  timeoutMs = 2000,
}: DoubleBackExitGuardOptions) => {
  const lastBackAtRef = useRef(0);
  const resetTimeoutRef = useRef<number | null>(null);
  const isGuardArmedRef = useRef(false);
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
    if (requireAppLikeEnvironment && !isAppLikeBackButtonEnvironment()) return;

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

    const getStateObject = () => {
      const currentState = window.history.state;

      return typeof currentState === "object" && currentState !== null
        ? currentState
        : {};
    };

    const replaceExitBase = () => {
      window.history.replaceState(
        {
          ...getStateObject(),
          booklogExitBase: guardId,
        },
        "",
        window.location.href,
      );
    };

    const pushExitGuard = () => {
      if (isGuardArmedRef.current) return;

      window.history.pushState(
        {
          ...getStateObject(),
          booklogExitGuard: guardId,
        },
        "",
        window.location.href,
      );
      isGuardArmedRef.current = true;
    };

    replaceExitBase();
    pushExitGuard();

    const handlePopState = () => {
      if (
        hasActiveBackNavigationLayer() ||
        wasBackNavigationLayerClosedRecently()
      ) {
        return;
      }

      isGuardArmedRef.current = false;
      lastBackAtRef.current = Date.now();
      onFirstBackRef.current();
      clearResetTimer();
      resetTimeoutRef.current = window.setTimeout(() => {
        resetFirstBack();
        pushExitGuard();
      }, timeoutMsRef.current);
    };

    const handleUserInteraction = () => {
      if (lastBackAtRef.current === 0) return;

      resetFirstBack();
      pushExitGuard();
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pointerdown", handleUserInteraction, {
      passive: true,
    });
    window.addEventListener("keydown", handleUserInteraction);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pointerdown", handleUserInteraction);
      window.removeEventListener("keydown", handleUserInteraction);
      clearResetTimer();
      isGuardArmedRef.current = false;
    };
  }, [isActive, requireAppLikeEnvironment]);
};
