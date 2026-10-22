const API_NOT_FOUND = {
  error: "not_found",
  message: "No such API route. See /llms.txt.",
};

const METHOD_NOT_ALLOWED = {
  error: "method_not_allowed",
  message: "Method not allowed.",
};

export function apiNotFound(): Response {
  return Response.json(API_NOT_FOUND, { status: 404 });
}

export function createMethodNotAllowed(allowedMethods: readonly string[]) {
  const allow = allowedMethods.join(", ");

  return (request: Request): Response =>
    new Response(
      request.method === "HEAD" ? null : JSON.stringify(METHOD_NOT_ALLOWED),
      {
        status: 405,
        headers: {
          Allow: allow,
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
}

export function createOptions(allowedMethods: readonly string[]) {
  const allow = allowedMethods.join(", ");

  return (): Response => new Response(null, { status: 204, headers: { Allow: allow } });
}
