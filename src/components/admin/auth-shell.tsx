import { LogoMark } from "@/components/ui/logo";

/** Centered card used by the login and setup screens. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-start justify-center px-4 py-10 sm:items-center">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2.5">
          <LogoMark />
          <span className="font-display text-lg font-bold">Shop admin</span>
        </div>
        <div className="rounded-[24px] border border-line bg-surface p-6 sm:p-7">
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          {subtitle ? <div className="mt-1.5 text-muted">{subtitle}</div> : null}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
