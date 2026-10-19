import fs from "fs";
import path from "path";

export async function GET() {
  const filePath = path.join(process.cwd(), "docs", "ziki-for-agents.md");
  const content = fs.readFileSync(filePath, "utf8");
  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}