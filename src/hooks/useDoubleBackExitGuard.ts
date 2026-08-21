import { useEffect } from "react";
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

type DoubleBackExitGuardCallbacks = {
  onFirstBack?: () => void;
  onReset?: () => void;
};

type DoubleBackExitGuardInitOptions = {
  requireAppLikeEnvironment?: boolean;
  timeoutMs?: number;
};

let isExitGuardInitialized = false;
let lastBackAt = 0;
let resetTimeoutId: number | null = null;
let isGuardArmed = false;
let callbacks: DoubleBackExitGuardCallbacks = {};

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

const logBackState = (stage: string) => {
  console.log("[PWA Back]", {
    stage,
    pathname: window.location.pathname,
    historyLength: window.history.length,
    historyState: window.history.state,
  });
};

const clearResetTimer = () => {
  if (resetTimeoutId === null) return;

  window.clearTimeout(resetTimeoutId);
  resetTimeoutId = null;
};

const resetFirstBack = () => {
  lastBackAt = 0;
  clearResetTimer();
  callbacks.onReset?.();
};

const getStateObject = () => {
  const currentState = window.history.state;

  return typeof currentState === "object" && currentState !== null
    ? currentState
    : {};
};

const replaceExitBase = (guardId: string) => {
  window.history.replaceState(
    {
      ...getStateObject(),
      booklogExitBase: guardId,
    },
    "",
    window.location.href,
  );
  logBackState("replace-exit-base");
};

const pushExitGuard = (guardId: string) => {
  if (isGuardArmed) return;

  window.history.pushState(
    {
      ...getStateObject(),
      booklogExitGuard: guardId,
    },
    "",
    window.location.href,
  );
  isGuardArmed = true;
  logBackState("push-exit-guard");
};

export const initializeDoubleBackExitGuard = ({
  requireAppLikeEnvironment = true,
  timeoutMs = 2000,
}: DoubleBackExitGuardInitOptions = {}) => {
  if (typeof window === "undefined") return;
  if (isExitGuardInitialized) return;
  if (requireAppLikeEnvironment && !isAppLikeBackButtonEnvironment()) return;

  const guardId = `booklog-exit-${Date.now()}`;

  const handlePopState = () => {
    logBackState("popstate");

    if (
      hasActiveBackNavigationLayer() ||
      wasBackNavigationLayerClosedRecently()
    ) {
      logBackState("popstate-layer-skip");
      return;
    }

    const now = Date.now();
    const isSecondBack = lastBackAt > 0 && now - lastBackAt <= timeoutMs;

    if (isSecondBack) {
      logBackState("second-back-exit");
      resetFirstBack();
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pointerdown", handleUserInteraction);
      window.removeEventListener("keydown", handleUserInteraction);
      isGuardArmed = false;
      isExitGuardInitialized = false;
      window.history.back();
      return;
    }

    isGuardArmed = false;
    lastBackAt = now;
    callbacks.onFirstBack?.();
    logBackState("first-back-toast");
    pushExitGuard(guardId);
    clearResetTimer();
    resetTimeoutId = window.setTimeout(() => {
      resetFirstBack();
      logBackState("first-back-timeout-reset");
    }, timeoutMs);
  };

  const handleUserInteraction = () => {
    if (lastBackAt === 0) return;

    resetFirstBack();
    pushExitGuard(guardId);
  };

  isExitGuardInitialized = true;
  replaceExitBase(guardId);
  pushExitGuard(guardId);
  window.addEventListener("popstate", handlePopState);
  window.addEventListener("pointerdown", handleUserInteraction, {
    passive: true,
  });
  window.addEventListener("keydown", handleUserInteraction);
  logBackState("guard-ready");
};

export const useDoubleBackExitGuard = ({
  isActive,
  onFirstBack,
  onReset,
  requireAppLikeEnvironment = true,
  timeoutMs = 2000,
}: DoubleBackExitGuardOptions) => {
  useEffect(() => {
    if (!isActive) return;

    callbacks = { onFirstBack, onReset };
    initializeDoubleBackExitGuard({ requireAppLikeEnvironment, timeoutMs });

    return () => {
      callbacks = {};
    };
  }, [isActive, onFirstBack, onReset, requireAppLikeEnvironment, timeoutMs]);
};
