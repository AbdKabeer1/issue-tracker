import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignInButton, SignOutButton } from "@/components/AuthButtons";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <main>
      <h1>Bug Tracker</h1>
      {session?.user ? (
        <>
          <p>Signed in as {session.user.email}</p>
          <SignOutButton />
        </>
      ) : (
        <>
          <p>Sign in to continue.</p>
          <SignInButton />
        </>
      )}
    </main>
  );
}
