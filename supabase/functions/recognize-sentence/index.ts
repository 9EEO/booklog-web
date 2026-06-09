const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type OcrField = {
  inferText?: string;
  lineBreak?: boolean;
};

type OcrResponse = {
  images?: Array<{
    inferResult?: string;
    message?: string;
    fields?: OcrField[];
  }>;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const extractText = (response: OcrResponse) => {
  const lines: string[] = [];
  let currentLine: string[] = [];

  for (const image of response.images ?? []) {
    for (const field of image.fields ?? []) {
      const text = field.inferText?.trim();
      if (text) currentLine.push(text);

      if (field.lineBreak && currentLine.length > 0) {
        lines.push(currentLine.join(" "));
        currentLine = [];
      }
    }
  }

  if (currentLine.length > 0) lines.push(currentLine.join(" "));

  return lines
    .join("\n")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
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
    const text = extractText(result);

    if (!text) {
      return jsonResponse({ error: "No text found" }, 422);
    }

    return jsonResponse({ text });
  } catch (error) {
    console.error("Sentence OCR failed", error);
    return jsonResponse({ error: "OCR request failed" }, 500);
  }
});
