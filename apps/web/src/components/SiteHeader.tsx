import Link from "next/link";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold">
          Joe&apos;s SIM
        </Link>
        <nav aria-label="Main" className="flex items-center gap-4">
          <Link href="/sim" className="text-accent underline-offset-4 hover:underline">
            Simulator
          </Link>
          <ThemeSwitcher />
        </nav>
      </div>
    </header>
  );
}
