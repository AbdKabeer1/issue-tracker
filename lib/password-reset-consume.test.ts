import { describe, expect, it, vi } from "vitest";
import { consumeResetToken } from "./password-reset-consume";

function fakeTx(claimedCount: number) {
  return {
    passwordResetToken: {
      updateMany: vi.fn().mockResolvedValue({ count: claimedCount }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: { update: vi.fn().mockResolvedValue({}) },
    agentApiKey: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
}

const now = new Date("2026-10-17T00:00:00Z");
const args = { tokenId: "tok1", userId: "u1", passwordHash: "hash", now };

describe("consumeResetToken", () => {
  it("claims only an unused, unexpired token", async () => {
    const tx = fakeTx(1);
    await consumeResetToken(tx as never, args);
    expect(tx.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { id: "tok1", usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
  });

  it("sets the password and removes the user's other tokens after a successful claim", async () => {
    const tx = fakeTx(1);
    await expect(consumeResetToken(tx as never, args)).resolves.toBe(true);
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" }, data: expect.objectContaining({ passwordHash: "hash" }) }),
    );
    expect(tx.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", id: { not: "tok1" } },
    });
  });

  it("invalidates existing sessions by bumping sessionVersion (#208)", async () => {
    const tx = fakeTx(1);
    await consumeResetToken(tx as never, args);
    expect(tx.user.update.mock.calls[0][0].data.sessionVersion).toEqual({ increment: 1 });
  });

  it("revokes every live agent key the account owns (#513)", async () => {
    const tx = fakeTx(1);
    await consumeResetToken(tx as never, args);
    expect(tx.agentApiKey.updateMany).toHaveBeenCalledWith({
      where: { revokedAt: null, agent: { ownerUserId: "u1" } },
      data: { revokedAt: now },
    });
  });

  it("changes nothing when another request already claimed the token", async () => {
    const tx = fakeTx(0);
    await expect(consumeResetToken(tx as never, args)).resolves.toBe(false);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.passwordResetToken.deleteMany).not.toHaveBeenCalled();
    expect(tx.agentApiKey.updateMany).not.toHaveBeenCalled();
  });
});
