import { AppShell } from "@/components/app-shell";

export default function BoardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell fullBleed>{children}</AppShell>;
}
