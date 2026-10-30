import Link from "next/link";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold">
          Joe&apos;s SIM
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {(
            [
              ["/sim", "Simulator"],
              ["/learn", "Learn"],
              ["/challenges", "Challenges"],
              ["/progress", "Progress"],
            ] as const
          ).map(([href, label]) => (
            <Link key={href} href={href} className="text-accent underline-offset-4 hover:underline">
              {label}
            </Link>
          ))}
          <ThemeSwitcher />
        </nav>
      </div>
    </header>
  );
}
