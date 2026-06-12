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

export const vibrateTimerSelect = () => {
  if (canVibrate()) {
    navigator.vibrate(8);
  }
};

export const vibrateTimerStart = () => {
  if (canVibrate()) {
    navigator.vibrate([12, 24, 18]);
  }
};

export const vibrateTimerPause = () => {
  if (canVibrate()) {
    navigator.vibrate(24);
  }
};

export const vibrateTimerStop = () => {
  if (canVibrate()) {
    navigator.vibrate([34, 28, 52]);
  }
};

export const vibratePakEject = () => {
  if (canVibrate()) {
    navigator.vibrate([8, 18, 14]);
  }
};

export const vibratePakInsert = () => {
  if (canVibrate()) {
    navigator.vibrate([10, 18, 28]);
  }
};
