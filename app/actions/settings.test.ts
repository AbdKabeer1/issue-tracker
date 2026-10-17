import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth-helpers", () => ({ requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { update: vi.fn() } } }));

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { updateDisplayNameAction } from "./settings";

const update = prisma.user.update as unknown as ReturnType<typeof vi.fn>;
const form = (name: string) => {
  const f = new FormData();
  f.set("name", name);
  return f;
};

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "u1", role: "user" });
});

describe("updateDisplayNameAction (#293)", () => {
  it("saves the trimmed name for the signed-in user only, and nothing else", async () => {
    const result = await updateDisplayNameAction(undefined, form("  Ada   Lovelace "));
    expect(result).toEqual({ ok: true, name: "Ada Lovelace" });
    expect(update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { name: "Ada Lovelace" } });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("ignores any id, email or role smuggled into the form", async () => {
    const f = form("Ada Lovelace");
    f.set("id", "someone-else");
    f.set("email", "x@y.z");
    f.set("role", "super_admin");
    await updateDisplayNameAction(undefined, f);
    expect(update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { name: "Ada Lovelace" } });
  });

  it.each(["", "   ", "A", "​​", "Sam (Admin)"])(
    "rejects %j and names the field",
    async (name) => {
      const result = await updateDisplayNameAction(undefined, form(name));
      expect(result.ok).toBeUndefined();
      expect(result.field).toBe("name");
      expect(result.fieldErrors?.name).toBeTruthy();
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("lets an admin use the word", async () => {
    requireUser.mockResolvedValue({ id: "a1", role: "admin" });
    const result = await updateDisplayNameAction(undefined, form("Sam (Admin)"));
    expect(result.ok).toBe(true);
  });

  it("treats a missing field as blank", async () => {
    const result = await updateDisplayNameAction(undefined, new FormData());
    expect(result.field).toBe("name");
  });
});
