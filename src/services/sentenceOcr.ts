import { requireSupabase } from "./supabase";

const maximumImageBytes = 15 * 1024 * 1024;
const maximumImageDimension = 1800;

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

  return arrayBufferToBase64(await blob.arrayBuffer());
};

export const recognizeSentenceImage = async (file: File): Promise<string> => {
  const imageBase64 = await prepareImage(file);
  const supabase = requireSupabase();
  const { data, error } = await supabase.functions.invoke("recognize-sentence", {
    body: {
      format: "jpg",
      imageBase64,
    },
  });

  if (error) {
    throw new Error("사진 속 문장을 인식하지 못했습니다.");
  }

  const text = typeof data?.text === "string" ? data.text.trim() : "";
  if (!text) {
    throw new Error("사진에서 읽을 수 있는 문장을 찾지 못했습니다.");
  }

  return text;
};
