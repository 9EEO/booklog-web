const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type OcrField = {
  inferText?: string;
  lineBreak?: boolean;
  boundingPoly?: {
    vertices?: Array<{
      x?: number;
      y?: number;
    }>;
  };
};

type OcrResponse = {
  images?: Array<{
    inferResult?: string;
    message?: string;
    fields?: OcrField[];
  }>;
};

type RecognizedLine = {
  text: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const cleanLineText = (value: string) =>
  value
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const getBoundingBox = (fields: OcrField[]) => {
  const vertices = fields.flatMap(
    (field) => field.boundingPoly?.vertices ?? [],
  );
  const xs = vertices
    .map((vertex) => vertex.x)
    .filter((value): value is number => Number.isFinite(value));
  const ys = vertices
    .map((vertex) => vertex.y)
    .filter((value): value is number => Number.isFinite(value));

  if (xs.length === 0 || ys.length === 0) return undefined;

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
};

const extractLines = (response: OcrResponse) => {
  const lines: RecognizedLine[] = [];
  let currentLineFields: OcrField[] = [];

  const pushCurrentLine = () => {
    const text = cleanLineText(
      currentLineFields
        .map((field) => field.inferText?.trim())
        .filter(Boolean)
        .join(" "),
    );

    if (text) {
      lines.push({
        text,
        boundingBox: getBoundingBox(currentLineFields),
      });
    }

    currentLineFields = [];
  };

  for (const image of response.images ?? []) {
    for (const field of image.fields ?? []) {
      const text = field.inferText?.trim();
      if (text) currentLineFields.push(field);

      if (field.lineBreak && currentLineFields.length > 0) {
        pushCurrentLine();
      }
    }
  }

  if (currentLineFields.length > 0) pushCurrentLine();

  return lines;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const invokeUrl = Deno.env.get("CLOVA_OCR_INVOKE_URL");
  const secret = Deno.env.get("CLOVA_OCR_SECRET");

  if (!invokeUrl || !secret) {
    return jsonResponse({ error: "OCR service is not configured" }, 500);
  }

  try {
    const payload = await request.json();
    const imageBase64 =
      typeof payload.imageBase64 === "string" ? payload.imageBase64 : "";
    const format = payload.format === "png" ? "png" : "jpg";
    const imageWidth =
      typeof payload.imageWidth === "number" ? payload.imageWidth : null;
    const imageHeight =
      typeof payload.imageHeight === "number" ? payload.imageHeight : null;

    if (!imageBase64 || imageBase64.length > 10_000_000) {
      return jsonResponse({ error: "Invalid image" }, 400);
    }

    const ocrResponse = await fetch(invokeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OCR-SECRET": secret,
      },
      body: JSON.stringify({
        version: "V2",
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        lang: "ko",
        enableTableDetection: false,
        images: [
          {
            format,
            name: "sentence",
            data: imageBase64,
          },
        ],
      }),
    });

    if (!ocrResponse.ok) {
      console.error("CLOVA OCR request failed", ocrResponse.status);
      return jsonResponse({ error: "OCR request failed" }, 502);
    }

    const result = (await ocrResponse.json()) as OcrResponse;
    const lines = extractLines(result);
    const text = lines.map((line) => line.text).join("\n").trim();

    if (!text) {
      return jsonResponse({ error: "No text found" }, 422);
    }

    return jsonResponse({ text, lines, imageWidth, imageHeight });
  } catch (error) {
    console.error("Sentence OCR failed", error);
    return jsonResponse({ error: "OCR request failed" }, 500);
  }
});
