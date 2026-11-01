import type { Metadata } from "next";
import { MachineDesigner } from "@/machines/MachineDesigner";

export const metadata: Metadata = {
  title: "Machine designer",
  description:
    "Design your own machine without writing code: memory, word size, registers and instructions made of micro-operations. Test it on a program and share it as a file or link.",
};

export default function MachinesPage() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Machine designer</h1>
        <p className="max-w-2xl">
          Make your own version of the Little Man Computer, or a new machine altogether. Choose its
          memory, word and registers, and build each instruction from small steps (micro-operations)
          chosen from lists. Test it on a program here, then share it as a file or a link. The
          format is described in the{" "}
          <a
            href="https://github.com/Joeboy77/Joes-SIM/blob/main/docs/specs/custom-machines.md"
            className="text-accent underline"
          >
            machine definition specification
          </a>
          .
        </p>
      </div>
      <MachineDesigner />
    </div>
  );
}
