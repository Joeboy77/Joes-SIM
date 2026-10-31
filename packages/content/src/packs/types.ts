import type { DialectId } from "@joes-sim/engine";

/**
 * A teacher pack (brief, 7.10): lessons, challenges and starter programs in a chosen order, with
 * a chosen dialect, as one JSON file. Learners open it with no account.
 */
export type PackItem =
  | { readonly type: "heading"; readonly title: string; readonly note?: string }
  | { readonly type: "lesson"; readonly slug: string; readonly note?: string }
  | { readonly type: "challenge"; readonly id: string; readonly note?: string }
  | {
      readonly type: "program";
      readonly title: string;
      readonly source: string;
      readonly inputs?: string;
      readonly note?: string;
    };

export interface Pack {
  readonly format: "joes-sim-pack";
  readonly version: 1;
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly description: string;
  /** Used for the pack's programs, and shown to learners. Challenges keep their own. */
  readonly dialect: DialectId;
  readonly items: readonly PackItem[];
}

export const PACK_FORMAT = "joes-sim-pack";
