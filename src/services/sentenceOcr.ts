import { requireSupabase } from "./supabase";

const maximumImageBytes = 15 * 1024 * 1024;
const maximumImageDimension = 1800;

export type OcrLineBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RecognizedSentenceLine = {
  text: string;
  boundingBox?: OcrLineBoundingBox;
};

export type RecognizedSentenceImage = {
  text: string;
  lines: RecognizedSentenceLine[];
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
};

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("이미지를 변환하지 못했습니다."));
      },
      "image/jpeg",
      0.82,
    );
  });

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return window.btoa(binary);
};

const prepareImage = async (file: File) => {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일을 선택해 주세요.");
  }

  if (file.size > maximumImageBytes) {
    throw new Error("15MB 이하의 이미지를 선택해 주세요.");
  }

  let image: ImageBitmap;

  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error("이 이미지 형식은 인식할 수 없습니다. JPG 또는 PNG를 사용해 주세요.");
  }

  const scale = Math.min(
    maximumImageDimension / Math.max(image.width, image.height),
    1,
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(Math.round(image.width * scale), 1);
  canvas.height = Math.max(Math.round(image.height * scale), 1);

  const context = canvas.getContext("2d");
  if (!context) {
    image.close();
    throw new Error("이미지를 처리하지 못했습니다.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();

  const blob = await canvasToBlob(canvas);

  return {
    imageBase64: arrayBufferToBase64(await blob.arrayBuffer()),
    imageUrl: URL.createObjectURL(blob),
    imageWidth: canvas.width,
    imageHeight: canvas.height,
  };
};

const isBoundingBox = (value: unknown): value is OcrLineBoundingBox => {
  if (typeof value !== "object" || value === null) return false;

  const box = value as Record<string, unknown>;

  return ["x", "y", "width", "height"].every(
    (key) => typeof box[key] === "number" && Number.isFinite(box[key]),
  );
};

const normalizeLines = (value: unknown, fallbackText: string) => {
  if (Array.isArray(value)) {
    const lines = value
      .map((line): RecognizedSentenceLine | null => {
        if (typeof line !== "object" || line === null) return null;

        const record = line as Record<string, unknown>;
        const text = typeof record.text === "string" ? record.text.trim() : "";
        if (!text) return null;

        return {
          text,
          boundingBox: isBoundingBox(record.boundingBox)
            ? record.boundingBox
            : undefined,
        };
      })
      .filter((line): line is RecognizedSentenceLine => Boolean(line));

    if (lines.length > 0) return lines;
  }

  return fallbackText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({ text }));
};

export const recognizeSentenceImage = async (
  file: File,
): Promise<RecognizedSentenceImage> => {
  const preparedImage = await prepareImage(file);
  const supabase = requireSupabase();

  try {
    const { data, error } = await supabase.functions.invoke(
      "recognize-sentence",
      {
        body: {
          format: "jpg",
          imageBase64: preparedImage.imageBase64,
          imageWidth: preparedImage.imageWidth,
          imageHeight: preparedImage.imageHeight,
        },
      },
    );

    if (error) {
      throw new Error("사진 속 문장을 인식하지 못했습니다.");
    }

    const text = typeof data?.text === "string" ? data.text.trim() : "";
    if (!text) {
      throw new Error("사진에서 읽을 수 있는 문장을 찾지 못했습니다.");
    }

    return {
      text,
      lines: normalizeLines(data?.lines, text),
      imageUrl: preparedImage.imageUrl,
      imageWidth: preparedImage.imageWidth,
      imageHeight: preparedImage.imageHeight,
    };
  } catch (error) {
    URL.revokeObjectURL(preparedImage.imageUrl);
    throw error;
  }
};
