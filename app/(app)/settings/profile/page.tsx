import Link from "next/link";
import { DisplayNameForm } from "@/components/display-name-form";
import { requireUser } from "@/lib/auth-helpers";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link href="/settings" className="text-sm text-teal-700 hover:underline">
          ← Back to settings
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-600">
          Manage how your name appears on issues and comments.
        </p>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Your profile
        </h2>
        <DisplayNameForm initialName={user.name ?? ""} />
        <div className="mt-6 space-y-1">
          <p className="text-sm font-medium text-slate-800">Email</p>
          <p className="break-words text-sm text-slate-600">{user.email}</p>
          <p className="text-xs text-slate-500">Your sign-in email cannot be changed here.</p>
        </div>
        <p className="mt-6 text-sm">
          <Link href={`/users/${user.id}`} className="text-teal-700 hover:underline">
            See how your profile looks to others
          </Link>
        </p>
      </section>
    </div>
  );
}
