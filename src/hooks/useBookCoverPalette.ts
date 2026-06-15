import { useEffect, useMemo, useState } from "react";

type BookCoverPalette = {
  top: string;
  bottom: string;
};

const paletteCache = new Map<string, BookCoverPalette>();
const cacheKeyPrefix = "booklog-cover-palette:v3:";

const getCachedPalette = (cacheKey: string) => {
  const memoryCached = paletteCache.get(cacheKey);
  if (memoryCached) return memoryCached;

  try {
    const stored = window.localStorage.getItem(cacheKey);
    if (!stored) return null;

    const cached = JSON.parse(stored) as BookCoverPalette;
    paletteCache.set(cacheKey, cached);
    return cached;
  } catch {
    return null;
  }
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const rgbToHsl = (red: number, green: number, blue: number) => {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const lightness = (maximum + minimum) / 2;

  if (maximum === minimum) {
    return { hue: 0, saturation: 0, lightness };
  }

  const delta = maximum - minimum;
  const saturation =
    lightness > 0.5
      ? delta / (2 - maximum - minimum)
      : delta / (maximum + minimum);
  const hue =
    maximum === r
      ? ((g - b) / delta + (g < b ? 6 : 0)) / 6
      : maximum === g
        ? ((b - r) / delta + 2) / 6
        : ((r - g) / delta + 4) / 6;

  return { hue, saturation, lightness };
};

const hslToHex = (hue: number, saturation: number, lightness: number) => {
  const channel = (offset: number) => {
    const value = (offset + hue * 12) % 12;
    const chroma = saturation * Math.min(lightness, 1 - lightness);
    return lightness - chroma * Math.max(-1, Math.min(value - 3, 9 - value, 1));
  };
  const toHex = (value: number) =>
    Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(channel(0))}${toHex(channel(8))}${toHex(channel(4))}`;
};

const normalizePackColor = (red: number, green: number, blue: number) => {
  const { hue, saturation, lightness } = rgbToHsl(red, green, blue);

  return hslToHex(
    hue,
    clamp(saturation, 0.42, 0.82),
    clamp(lightness, 0.32, 0.58),
  );
};

const extractRegionColor = (
  context: CanvasRenderingContext2D,
  y: number,
  height: number,
) => {
  const pixels = context.getImageData(0, y, 24, height).data;
  const buckets = new Map<
    string,
    { red: number; green: number; blue: number; score: number; count: number }
  >();

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 180) continue;

    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const { saturation, lightness } = rgbToHsl(red, green, blue);
    if (lightness < 0.06 || lightness > 0.94) continue;

    const key = `${Math.round(red / 32)}-${Math.round(green / 32)}-${Math.round(blue / 32)}`;
    if (saturation < 0.14) continue;

    const weight = 0.35 + saturation * saturation * 5;
    const bucket = buckets.get(key) ?? {
      red: 0,
      green: 0,
      blue: 0,
      score: 0,
      count: 0,
    };

    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    bucket.score += weight;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const dominant = [...buckets.values()].sort(
    (left, right) => right.score - left.score,
  )[0];

  if (!dominant) return null;

  return normalizePackColor(
    dominant.red / dominant.count,
    dominant.green / dominant.count,
    dominant.blue / dominant.count,
  );
};

const normalizeFallback = (hex: string) => {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return "#ef4548";

  return normalizePackColor(
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  );
};

const getAnalyzableImageUrl = (thumbnail: string) => {
  try {
    const source = new URL(thumbnail);

    return source.hostname.endsWith("kakaocdn.net")
      ? `/api/cover-image?url=${encodeURIComponent(thumbnail)}`
      : thumbnail;
  } catch {
    return thumbnail;
  }
};

export const useBookCoverPalette = (
  bookId: string,
  thumbnail: string | undefined,
  coverColor: string,
  accentColor: string,
) => {
  const cacheKey = `${cacheKeyPrefix}${bookId}`;
  const fallback = useMemo(
    () => ({
      top: normalizeFallback(coverColor),
      bottom: normalizeFallback(accentColor),
    }),
    [accentColor, coverColor],
  );
  const cachedPalette = getCachedPalette(cacheKey);
  const [analyzedPalette, setAnalyzedPalette] = useState<{
    cacheKey: string;
    palette: BookCoverPalette;
  } | null>(null);

  useEffect(() => {
    if (cachedPalette || !thumbnail) return;

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 36;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const top = extractRegionColor(context, 0, 13);
        const bottom = extractRegionColor(context, 23, 13);
        if (!top || !bottom) return;

        const nextPalette = { top, bottom };

        paletteCache.set(cacheKey, nextPalette);
        setAnalyzedPalette({ cacheKey, palette: nextPalette });
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify(nextPalette));
        } catch {
          // Ignore storage quota and private browsing failures.
        }
      } catch {
        // The fallback palette remains active when canvas analysis is blocked.
      }
    };
    image.src = getAnalyzableImageUrl(thumbnail);
  }, [cacheKey, cachedPalette, fallback, thumbnail]);

  return analyzedPalette?.cacheKey === cacheKey
    ? analyzedPalette.palette
    : (cachedPalette ?? fallback);
};
