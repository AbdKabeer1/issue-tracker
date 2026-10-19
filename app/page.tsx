import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveSessionUserId } from "@/lib/session-user";
import { homePathFor } from "@/lib/tenants";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // #444: someone with no tenant, or with several and none picked on this
  // device, chooses one first. Everyone else lands on the issue list. A
  // session that can't be resolved goes there too, where requireUser deals
  // with it.
  const resolved = await resolveSessionUserId();
  redirect("userId" in resolved ? await homePathFor(prisma, resolved.userId) : "/issues");
}
