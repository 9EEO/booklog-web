import { useEffect, useRef } from "react";

type PixelatedBookCoverProps = {
  src: string;
  alt?: string;
  className?: string;
  dotSize?: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getCoverCrop = (
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) => {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;

  if (sourceRatio > targetRatio) {
    const width = sourceHeight * targetRatio;

    return {
      sourceX: (sourceWidth - width) / 2,
      sourceY: 0,
      sourceWidth: width,
      sourceHeight,
    };
  }

  const height = sourceWidth / targetRatio;

  return {
    sourceX: 0,
    sourceY: (sourceHeight - height) / 2,
    sourceWidth,
    sourceHeight: height,
  };
};

export function PixelatedBookCover({
  src,
  alt = "",
  className,
  dotSize = 5,
}: PixelatedBookCoverProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    let animationFrame = 0;
    let disposed = false;

    const drawFallbackDots = () => {
      const context = canvas.getContext("2d");

      const bounds = canvas.getBoundingClientRect();
      const displayWidth = Math.max(1, Math.round(bounds.width || 96));
      const displayHeight = Math.max(1, Math.round(bounds.height || 144));

      if (!context) return;

      canvas.width = displayWidth;
      canvas.height = displayHeight;
      context.clearRect(0, 0, displayWidth, displayHeight);

      for (let y = 1; y < displayHeight; y += dotSize) {
        for (let x = 1; x < displayWidth; x += dotSize) {
          context.fillStyle =
            (x + y) % (dotSize * 3) === 0
              ? "rgba(255, 254, 248, 0.22)"
              : "rgba(21, 21, 21, 0.2)";
          context.fillRect(x, y, 1.25, 1.25);
        }
      }
    };

    const draw = (image: HTMLImageElement) => {
      const context = canvas.getContext("2d");

      if (!context || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        drawFallbackDots();
        return;
      }

      const bounds = canvas.getBoundingClientRect();
      const displayWidth = Math.max(1, Math.round(bounds.width || 96));
      const displayHeight = Math.max(1, Math.round(bounds.height || 144));
      const sampleWidth = clamp(Math.round(displayWidth / dotSize), 18, 64);
      const sampleHeight = clamp(Math.round(displayHeight / dotSize), 24, 92);
      const crop = getCoverCrop(
        image.naturalWidth,
        image.naturalHeight,
        sampleWidth,
        sampleHeight,
      );
      const sampleCanvas = document.createElement("canvas");
      const sampleContext = sampleCanvas.getContext("2d", {
        willReadFrequently: true,
      });

      if (!sampleContext) {
        drawFallbackDots();
        return;
      }

      sampleCanvas.width = sampleWidth;
      sampleCanvas.height = sampleHeight;
      sampleContext.imageSmoothingEnabled = true;
      sampleContext.imageSmoothingQuality = "high";
      sampleContext.drawImage(
        image,
        crop.sourceX,
        crop.sourceY,
        crop.sourceWidth,
        crop.sourceHeight,
        0,
        0,
        sampleWidth,
        sampleHeight,
      );

      try {
        const samples = sampleContext.getImageData(
          0,
          0,
          sampleWidth,
          sampleHeight,
        ).data;

        canvas.width = displayWidth;
        canvas.height = displayHeight;
        context.clearRect(0, 0, displayWidth, displayHeight);

        for (let row = 0; row < sampleHeight; row += 1) {
          for (let column = 0; column < sampleWidth; column += 1) {
            const index = (row * sampleWidth + column) * 4;
            const red = samples[index];
            const green = samples[index + 1];
            const blue = samples[index + 2];
            const alpha = samples[index + 3] / 255;
            const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
            const inkDensity = clamp((255 - luminance) / 255, 0.08, 0.9);
            const x = column * dotSize + 1;
            const y = row * dotSize + 1;

            context.fillStyle = `rgba(21, 21, 21, ${0.58 * inkDensity * alpha})`;
            context.fillRect(x, y, 1.35, 1.35);
          }
        }
      } catch {
        drawFallbackDots();
      }
    };

    const requestDraw = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        if (image.complete) {
          draw(image);
        }
      });
    };

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (disposed) return;
      draw(image);
    };
    image.onerror = () => {
      if (disposed) return;
      drawFallbackDots();
    };
    image.src = src;

    const resizeObserver = new ResizeObserver(requestDraw);
    resizeObserver.observe(canvas);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [dotSize, src]);

  return (
    <span className={className}>
      <img alt={alt} draggable={false} src={src} />
      <canvas ref={canvasRef} aria-hidden="true" />
    </span>
  );
}
