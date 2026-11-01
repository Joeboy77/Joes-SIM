/**
 * Reads Little Language source into statements (docs/specs/little-language.md). One statement per
 * line; blocks end with `end`. Errors say what is wrong in plain language, with the line and column.
 */

export interface CompileError {
  /** 1-based line and columns; endColumn is exclusive. */
  readonly line: number;
  readonly column: number;
  readonly endColumn: number;
  readonly message: string;
}

export type Expr =
  | { readonly kind: "num"; readonly value: number; readonly line: number; readonly column: number }
  | { readonly kind: "var"; readonly name: string; readonly line: number; readonly column: number }
  | { readonly kind: "neg"; readonly arg: Expr; readonly line: number; readonly column: number }
  | {
      readonly kind: "bin";
      readonly op: "+" | "-" | "*" | "/" | "%";
      readonly left: Expr;
      readonly right: Expr;
      readonly line: number;
      readonly column: number;
    };

export type Compare = "==" | "!=" | "<" | "<=" | ">" | ">=";

export interface Condition {
  readonly left: Expr;
  readonly op: Compare;
  readonly right: Expr;
}

export type Stmt =
  | {
      readonly kind: "input";
      readonly name: string;
      readonly line: number;
      readonly column: number;
    }
  | { readonly kind: "print"; readonly expr: Expr; readonly line: number }
  | {
      readonly kind: "assign";
      readonly name: string;
      readonly expr: Expr;
      readonly line: number;
      readonly column: number;
    }
  | {
      readonly kind: "if";
      readonly cond: Condition;
      readonly then: readonly Stmt[];
      readonly otherwise: readonly Stmt[] | null;
      readonly line: number;
      /** Lines of `else` and `end`, for the mapping. */
      readonly elseLine: number | null;
      readonly endLine: number;
    }
  | {
      readonly kind: "while";
      readonly cond: Condition;
      readonly body: readonly Stmt[];
      readonly line: number;
      readonly endLine: number;
    };

export const KEYWORDS = new Set(["if", "then", "else", "end", "while", "do", "input", "print"]);

interface Token {
  readonly kind: "num" | "name" | "op" | "word";
  readonly text: string;
  readonly column: number;
}

const OPS = ["==", "!=", "<=", ">=", "<", ">", "=", "+", "-", "*", "/", "%", "(", ")"];

class LineError extends Error {
  constructor(
    readonly column: number,
    readonly endColumn: number,
    message: string,
  ) {
    super(message);
  }
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }
    if (ch === "#" || text.startsWith("//", i)) break;
    const column = i + 1;
    const num = /^\d+/.exec(text.slice(i));
    if (num) {
      tokens.push({ kind: "num", text: num[0], column });
      i += num[0].length;
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i));
    if (word) {
      tokens.push({ kind: KEYWORDS.has(word[0]) ? "word" : "name", text: word[0], column });
      i += word[0].length;
      continue;
    }
    const op = OPS.find((o) => text.startsWith(o, i));
    if (op) {
      tokens.push({ kind: "op", text: op, column });
      i += op.length;
      continue;
    }
    throw new LineError(column, column + 1, `'${ch}' is not part of the Little Language.`);
  }
  return tokens;
}

/** Parses one line's tokens; used for expressions and conditions. */
class Cursor {
  private i = 0;
  constructor(
    private readonly tokens: readonly Token[],
    private readonly line: number,
    private readonly lineLength: number,
  ) {}

  peek(): Token | undefined {
    return this.tokens[this.i];
  }

  next(): Token | undefined {
    return this.tokens[this.i++];
  }

  done(): boolean {
    return this.i >= this.tokens.length;
  }

  /** Where an error about the current position should point. */
  here(): [number, number] {
    const t = this.peek();
    return t ? [t.column, t.column + t.text.length] : [this.lineLength + 1, this.lineLength + 2];
  }

  expression(): Expr {
    let left = this.term();
    for (
      let t = this.peek();
      t?.kind === "op" && (t.text === "+" || t.text === "-");
      t = this.peek()
    ) {
      this.next();
      const right = this.term();
      left = { kind: "bin", op: t.text, left, right, line: this.line, column: t.column };
    }
    return left;
  }

  private term(): Expr {
    let left = this.factor();
    for (
      let t = this.peek();
      t?.kind === "op" && (t.text === "*" || t.text === "/" || t.text === "%");
      t = this.peek()
    ) {
      this.next();
      const right = this.factor();
      left = { kind: "bin", op: t.text, left, right, line: this.line, column: t.column };
    }
    return left;
  }

  private factor(): Expr {
    const t = this.next();
    if (!t) {
      const [c, e] = [this.lineLength + 1, this.lineLength + 2];
      throw new LineError(c, e, "A value is missing at the end of the line.");
    }
    if (t.kind === "num")
      return { kind: "num", value: Number(t.text), line: this.line, column: t.column };
    if (t.kind === "name") return { kind: "var", name: t.text, line: this.line, column: t.column };
    if (t.kind === "op" && t.text === "-") {
      return { kind: "neg", arg: this.factor(), line: this.line, column: t.column };
    }
    if (t.kind === "op" && t.text === "(") {
      const inner = this.expression();
      const close = this.next();
      if (close?.text !== ")") {
        const [c, e] = close ? [close.column, close.column + close.text.length] : this.here();
        throw new LineError(c, e, "A '(' is not closed: add ')'.");
      }
      return inner;
    }
    const what = t.kind === "word" ? `the keyword '${t.text}'` : `'${t.text}'`;
    throw new LineError(
      t.column,
      t.column + t.text.length,
      `Expected a number, a name or '(' here, not ${what}.`,
    );
  }

  condition(keyword: string): Condition {
    const left = this.expression();
    const op = this.next();
    if (op?.kind !== "op" || !["==", "!=", "<", "<=", ">", ">="].includes(op.text)) {
      const [c, e] = op ? [op.column, op.column + op.text.length] : this.here();
      throw new LineError(
        c,
        e,
        op?.text === "="
          ? `Use '==' to compare in an ${keyword} condition; '=' sets a variable.`
          : `The ${keyword} condition needs a comparison: ==, !=, <, <=, > or >=.`,
      );
    }
    const right = this.expression();
    return { left, op: op.text as Compare, right };
  }
}

interface Frame {
  readonly kind: "if" | "while";
  readonly line: number;
  readonly column: number;
  readonly cond: Condition;
  readonly body: Stmt[];
  otherwise: Stmt[] | null;
  elseLine: number | null;
}

export interface ParseResult {
  readonly statements: readonly Stmt[];
  readonly errors: readonly CompileError[];
}

export function parse(source: string): ParseResult {
  const lines = source.split(/\r?\n/);
  const errors: CompileError[] = [];
  const root: Stmt[] = [];
  const stack: Frame[] = [];
  const target = (): Stmt[] => {
    const top = stack.at(-1);
    return top ? (top.otherwise ?? top.body) : root;
  };

  lines.forEach((text, index) => {
    const line = index + 1;
    /** An if or while whose line has an error still opens a block, so its 'end' matches. */
    let opening: "if" | "while" | null = null;
    let opened = false;
    try {
      const tokens = tokenize(text);
      if (tokens.length === 0) return;
      const c = new Cursor(tokens.slice(1), line, text.length);
      const first = tokens[0] as Token;
      const ensureEnd = () => {
        const extra = c.peek();
        if (extra) {
          throw new LineError(
            extra.column,
            text.length + 1,
            `Unexpected '${extra.text}' after the end of the statement.`,
          );
        }
      };
      if (first.kind === "word") {
        switch (first.text) {
          case "input": {
            const name = c.next();
            if (name?.kind !== "name") {
              const [s, e] = name ? [name.column, name.column + name.text.length] : c.here();
              throw new LineError(
                s,
                e,
                "input needs the name of a variable, for example 'input x'.",
              );
            }
            ensureEnd();
            target().push({ kind: "input", name: name.text, line, column: name.column });
            return;
          }
          case "print": {
            const expr = c.expression();
            ensureEnd();
            target().push({ kind: "print", expr, line });
            return;
          }
          case "if":
          case "while": {
            opening = first.text;
            const cond = c.condition(first.text);
            const word = first.text === "if" ? "then" : "do";
            const kw = c.next();
            if (kw?.text !== word) {
              const [s, e] = kw ? [kw.column, kw.column + kw.text.length] : c.here();
              throw new LineError(s, e, `'${first.text}' needs '${word}' after its condition.`);
            }
            ensureEnd();
            stack.push({
              kind: first.text,
              line,
              column: first.column,
              cond,
              body: [],
              otherwise: null,
              elseLine: null,
            });
            opened = true;
            return;
          }
          case "else": {
            const top = stack.at(-1);
            if (!top || top.kind !== "if" || top.otherwise) {
              throw new LineError(
                first.column,
                first.column + 4,
                "This 'else' does not belong to an 'if'.",
              );
            }
            ensureEnd();
            top.otherwise = [];
            top.elseLine = line;
            return;
          }
          case "end": {
            const top = stack.pop();
            if (!top)
              throw new LineError(
                first.column,
                first.column + 3,
                "This 'end' does not close an 'if' or a 'while'.",
              );
            ensureEnd();
            const stmt: Stmt =
              top.kind === "if"
                ? {
                    kind: "if",
                    cond: top.cond,
                    then: top.body,
                    otherwise: top.otherwise,
                    line: top.line,
                    elseLine: top.elseLine,
                    endLine: line,
                  }
                : { kind: "while", cond: top.cond, body: top.body, line: top.line, endLine: line };
            target().push(stmt);
            return;
          }
          default:
            throw new LineError(
              first.column,
              first.column + first.text.length,
              `'${first.text}' cannot start a statement here.`,
            );
        }
      }
      if (first.kind === "name") {
        const eq = c.next();
        if (eq?.text !== "=") {
          const [s, e] = eq ? [eq.column, eq.column + eq.text.length] : c.here();
          throw new LineError(
            s,
            e,
            `'${first.text}' is not a statement. To set a variable write '${first.text} = ...'; the statements are input, print, if and while.`,
          );
        }
        const expr = c.expression();
        ensureEnd();
        target().push({ kind: "assign", name: first.text, expr, line, column: first.column });
        return;
      }
      throw new LineError(
        first.column,
        first.column + first.text.length,
        `A statement cannot start with '${first.text}'.`,
      );
    } catch (e) {
      if (!(e instanceof LineError)) throw e;
      if (opening && !opened) {
        const zero: Expr = { kind: "num", value: 0, line, column: 1 };
        stack.push({
          kind: opening,
          line,
          column: 1,
          cond: { left: zero, op: "==", right: zero },
          body: [],
          otherwise: null,
          elseLine: null,
        });
      }
      errors.push({
        line,
        column: e.column,
        endColumn: e.endColumn,
        message: `Line ${line}: ${e.message}`,
      });
    }
  });

  for (const open of stack.reverse()) {
    errors.push({
      line: open.line,
      column: open.column,
      endColumn: open.column + open.kind.length,
      message: `Line ${open.line}: this '${open.kind}' has no 'end'. Add 'end' after its last statement.`,
    });
  }
  return { statements: root, errors };
}
