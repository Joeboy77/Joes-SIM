/**
 * Runs whole instructions on mutable working copies, with no events. Used for instant runs and
 * tests. It must end in exactly the state the micro-step machine would reach; a property test
 * checks this.
 */
import { getDialect } from "../../dialects/dialects";
import type { Dialect } from "../../dialects/types";
import {
  DECODE_STAGE,
  EXECUTE_START,
  alu,
  branchTaken,
  decode,
  executeLength,
} from "../../core/semantics";
import { MEMORY_SIZE, type MachineState, type OutputItem } from "../../core/types";
import { invalidMessage, toChar } from "./micro";

export type ExecOutcome = "ok" | "halted" | "error" | "waiting-input";

export class FastCore {
  readonly dialect: Dialect;
  memory: number[];
  pc: number;
  mar: number;
  mdr: number;
  ir: number;
  acc: number;
  negative: boolean;
  inputIndex: number;
  outputs: OutputItem[];
  cycles: number;
  microSteps: number;
  currentAddress: number;
  /** Increases on every memory write, so equal versions mean identical memory. */
  memoryVersion = 0;
  private memoryChanged = false;
  private outputsChanged = false;
  private status: MachineState["status"];
  private stage: number;
  private error: MachineState["error"];

  constructor(private readonly base: MachineState) {
    this.dialect = getDialect(base.dialect);
    this.memory = base.memory as number[];
    this.pc = base.pc;
    this.mar = base.mar;
    this.mdr = base.mdr;
    this.ir = base.ir;
    this.acc = base.acc;
    this.negative = base.negative;
    this.inputIndex = base.inputIndex;
    this.outputs = base.outputs as OutputItem[];
    this.cycles = base.cycles;
    this.microSteps = base.microSteps;
    this.currentAddress = base.currentAddress;
    this.status = base.status;
    this.stage = base.stage;
    this.error = base.error;
  }

  /** Runs one whole instruction from an instruction boundary. */
  exec(): ExecOutcome {
    const p = this.pc;
    const word = this.memory[p] as number;
    this.currentAddress = p;
    this.mar = p;
    this.mdr = word;
    this.ir = word;
    this.pc = p === MEMORY_SIZE - 1 ? 0 : p + 1;

    const d = decode(word, this.dialect);
    if (!d) {
      this.microSteps += DECODE_STAGE + 1;
      this.status = "error";
      this.stage = DECODE_STAGE;
      this.error = {
        code: "invalid-instruction",
        message: invalidMessage(word),
        address: p,
        value: word,
      };
      return "error";
    }

    let outcome: ExecOutcome = "ok";
    switch (d.mnemonic) {
      case "ADD":
      case "SUB": {
        this.mar = d.address;
        this.mdr = this.memory[d.address] as number;
        const r = alu(d.mnemonic === "ADD" ? "add" : "sub", this.acc, this.mdr, this.dialect);
        this.acc = r.result;
        this.negative = r.negative;
        break;
      }
      case "LDA":
        this.mar = d.address;
        this.mdr = this.memory[d.address] as number;
        this.acc = this.mdr;
        this.negative = this.mdr < 0;
        break;
      case "STA":
        this.mar = d.address;
        this.mdr = this.acc;
        if (this.memory[d.address] !== this.acc) {
          if (!this.memoryChanged) {
            this.memory = this.memory.slice();
            this.memoryChanged = true;
          }
          this.memory[d.address] = this.acc;
          this.memoryVersion++;
        }
        break;
      case "BRA":
      case "BRZ":
      case "BRP":
        if (branchTaken(d.mnemonic, this.acc, this.negative, this.dialect)) this.pc = d.address;
        break;
      case "INP": {
        if (this.inputIndex >= this.base.inputs.length) {
          this.microSteps += EXECUTE_START;
          this.status = "waiting-input";
          this.stage = EXECUTE_START;
          return "waiting-input";
        }
        const value = this.base.inputs[this.inputIndex] as number;
        this.acc = value;
        this.negative = value < 0;
        this.inputIndex++;
        break;
      }
      case "OUT":
      case "OTC":
        if (!this.outputsChanged) {
          this.outputs = this.outputs.slice();
          this.outputsChanged = true;
        }
        this.outputs.push(
          d.mnemonic === "OUT"
            ? { kind: "number", value: this.acc }
            : { kind: "char", value: this.acc, char: toChar(this.acc) },
        );
        break;
      case "HLT":
        this.status = "halted";
        outcome = "halted";
        break;
    }
    this.microSteps += EXECUTE_START + executeLength(d.mnemonic);
    this.cycles++;
    return outcome;
  }

  /** Copies memory so later writes cannot affect a snapshot taken from this core. */
  snapshotMemory(): number[] {
    return this.memory.slice();
  }

  toState(): MachineState {
    return {
      dialect: this.base.dialect,
      memory: this.memory,
      pc: this.pc,
      mar: this.mar,
      mdr: this.mdr,
      ir: this.ir,
      acc: this.acc,
      negative: this.negative,
      inputs: this.base.inputs,
      inputIndex: this.inputIndex,
      outputs: this.outputs,
      status: this.status,
      error: this.error,
      stage: this.stage,
      currentAddress: this.currentAddress,
      cycles: this.cycles,
      microSteps: this.microSteps,
    };
  }
}
