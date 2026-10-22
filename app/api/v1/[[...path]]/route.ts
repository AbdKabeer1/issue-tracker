import { apiNotFound } from "@/lib/agent-api/http-errors";

export const GET = (req: Request) => apiNotFound(req);
export const POST = (req: Request) => apiNotFound(req);
export const PUT = (req: Request) => apiNotFound(req);
export const PATCH = (req: Request) => apiNotFound(req);
export const DELETE = (req: Request) => apiNotFound(req);
export const HEAD = (req: Request) => apiNotFound(req);
export const OPTIONS = (req: Request) => apiNotFound(req);
