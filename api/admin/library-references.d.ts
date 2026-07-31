import type { IncomingMessage, ServerResponse } from "node:http";

type DevJsonRequest = IncomingMessage & {
  body?: unknown;
  query?: Record<string, string>;
};

type VercelJsonResponse = ServerResponse & {
  status: (statusCode: number) => VercelJsonResponse;
  json: (body: unknown) => void;
};

declare const handler: (
  request: DevJsonRequest,
  response: VercelJsonResponse,
) => Promise<void>;

export default handler;
