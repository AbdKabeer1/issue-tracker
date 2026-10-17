import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { NotificationSettings } from "@/components/notification-settings";
import { DisplayNameForm } from "@/components/display-name-form";

/* Distinct browser-tab title; the root layout appends "· Zedu Issues". */
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      email: true,
      emailNotifications: true,
      notifyMentions: true,
      notifyAssignments: true,
      notifyStatusChanges: true,
    },
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
          Profile
        </h2>
        <DisplayNameForm initialName={settings?.name ?? user.name ?? ""} />
        <p className="mt-3 text-sm">
          <Link href={`/users/${user.id}`} className="text-teal-700 hover:underline">
            See how your profile looks to others
          </Link>
        </p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Email notifications
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Sent to <span className="font-medium text-slate-800">{settings?.email}</span>.
          You&apos;re never emailed about your own changes.
        </p>
        <NotificationSettings
          initialEnabled={settings?.emailNotifications ?? true}
          initialPrefs={{
            notifyMentions: settings?.notifyMentions ?? true,
            notifyAssignments: settings?.notifyAssignments ?? true,
            notifyStatusChanges: settings?.notifyStatusChanges ?? true,
          }}
        />
      </section>
    </div>
  );
}
