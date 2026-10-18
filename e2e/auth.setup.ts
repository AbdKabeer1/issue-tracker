import { test as setup, expect, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import { E2E_PASSWORD, ROLES, WIDTHS, authFile, emailFor } from "./users";

/**
 * Signs every seeded account in once and saves its session, so the specs
 * start signed in instead of each spending a rate-limited login (#207).
 * The sign-in form itself is covered in auth.spec.ts.
 */
async function signIn(request: APIRequestContext, email: string) {
  const { csrfToken } = await (await request.get("/api/auth/csrf")).json();
  await request.post("/api/auth/callback/credentials", {
    form: { csrfToken, email, password: E2E_PASSWORD },
  });
  const session = await (await request.get("/api/auth/session")).json();
  expect(session?.user?.email, `signed in as ${email}`).toBe(email);
}

fs.mkdirSync("e2e/.auth", { recursive: true });

for (const width of WIDTHS) {
  for (const role of ROLES) {
    setup(`sign in ${role} (${width})`, async ({ playwright, baseURL }) => {
      const request = await playwright.request.newContext({ baseURL });
      await signIn(request, emailFor(role, width));
      await request.storageState({ path: authFile(role, width) });
      await request.dispose();
    });
  }
}
