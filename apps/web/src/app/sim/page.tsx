import type { Metadata } from "next";
import { Simulator } from "@/sim/Simulator";

export const metadata: Metadata = {
  title: "Simulator",
  description: "Write, run and step through Little Man Computer programs, forwards and backwards.",
};

export default function SimulatorPage() {
  return <Simulator />;
}
