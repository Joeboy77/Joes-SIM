import type { Metadata } from "next";
import { CompilerWorkbench } from "@/compiler/CompilerWorkbench";

export const metadata: Metadata = {
  title: "Little Language compiler",
  description:
    "Write a program with variables, if, while, input and print, and see it compiled to Little Man Computer code line by line, then run both side by side.",
};

export default function CompilerPage() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Little Language compiler</h1>
        <p className="max-w-2xl">
          Write a short program on the left and see the Little Man Computer code it becomes on the
          right. Click a line on either side to see where it went. When the program runs, the line
          and the instruction running now are highlighted together. The language is described on the{" "}
          <a
            href="https://github.com/Joeboy77/Joes-SIM/blob/main/docs/specs/little-language.md"
            className="text-accent underline"
          >
            Little Language page
          </a>
          .
        </p>
      </div>
      <CompilerWorkbench />
    </div>
  );
}
