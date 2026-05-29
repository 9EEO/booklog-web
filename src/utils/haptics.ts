const canVibrate = () =>
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

export const vibrateTap = () => {
  if (canVibrate()) {
    navigator.vibrate(10);
  }
};

export const vibrateSelect = () => {
  if (canVibrate()) {
    navigator.vibrate(15);
  }
};

export const vibrateSuccess = () => {
  if (canVibrate()) {
    navigator.vibrate([18, 30, 18]);
  }
};

export const vibrateWarning = () => {
  if (canVibrate()) {
    navigator.vibrate([40, 30, 40]);
  }
};
