import fs from "fs";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-static";

interface CachedDoc {
  content: string;
  etag: string;
}

let cachedDoc: CachedDoc | null = null;

function loadDoc(): CachedDoc {
  if (cachedDoc) {
    return cachedDoc;
  }
  const filePath = path.join(process.cwd(), "docs", "ziki-for-agents.md");
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error("[llms.txt] could not read docs/ziki-for-agents.md", error);
    content = "# Ziki for Agents\n";
  }
  const hash = crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
  const etag = `"${hash}"`;
  cachedDoc = { content, etag };
  return cachedDoc;
}

export async function GET(request: Request) {
  const { content, etag } = loadDoc();

  const ifNoneMatch = request.headers?.get("if-none-match");
  if (ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch === `W/${etag}`)) {
    return new Response(null, {
      status: 304,
      headers: {
        "ETag": etag,
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "ETag": etag,
    },
  });
}
