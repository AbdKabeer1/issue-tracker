import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { NotificationSettings } from "@/components/notification-settings";

/* Distinct browser-tab title; the root layout appends "· Zedu Issues". */
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, emailNotifications: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link href="/bugs" className="text-sm text-teal-700 hover:underline">
          ← Back to issues
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Email notifications
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Sent to <span className="font-medium text-slate-800">{settings?.email}</span> when
          someone @mentions you, assigns an issue to you or takes it from you, or changes the
          status of an issue you reported. You&apos;re never emailed about your own changes.
        </p>
        <NotificationSettings initialEnabled={settings?.emailNotifications ?? true} />
      </section>
    </div>
  );
}
