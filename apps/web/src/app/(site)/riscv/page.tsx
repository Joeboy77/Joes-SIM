import type { Metadata } from "next";
import Link from "next/link";
import { RiscvPage } from "@/riscv/RiscvPage";

export const metadata: Metadata = {
  title: "RISC-V",
  description:
    "Run RISC-V (RV32I) assembly step by step, with registers, the datapath stage by stage and plain-language explanations: a bridge from the Little Man Computer to RARS.",
};

export default function RiscvRoute() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">RISC-V</h1>
        <p className="max-w-2xl">
          A small part of a real instruction set, RV32I, laid out and numbered as in RARS: 32
          registers, real machine code, and system calls with{" "}
          <code className="font-mono">ecall</code>. Programs that work here work in RARS too. New to
          it? Start with the{" "}
          <Link href="/learn/lmc-to-riscv" className="text-accent underline">
            From LMC to RISC-V
          </Link>{" "}
          lesson.
        </p>
      </div>
      <RiscvPage />
    </div>
  );
}
