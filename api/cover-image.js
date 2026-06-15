const allowedHosts = new Set([
  "search1.kakaocdn.net",
  "search2.kakaocdn.net",
  "search3.kakaocdn.net",
  "search4.kakaocdn.net",
]);

export default async function handler(request, response) {
  try {
    const source = new URL(request.query.url);

    if (source.protocol !== "https:" || !allowedHosts.has(source.hostname)) {
      response.status(400).send("Unsupported image source");
      return;
    }

    const imageResponse = await fetch(source);
    if (!imageResponse.ok) {
      response.status(imageResponse.status).send("Image fetch failed");
      return;
    }

    response.setHeader(
      "Content-Type",
      imageResponse.headers.get("content-type") ?? "image/jpeg",
    );
    response.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    response.send(Buffer.from(await imageResponse.arrayBuffer()));
  } catch {
    response.status(400).send("Invalid image URL");
  }
}
