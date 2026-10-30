/** Progress kept on this device: challenges, predictions and lessons (brief, 7.7 to 7.9). */
import type { Targets } from "@joes-sim/content";
import { RECORDS, get, put } from "./db";

export type PredictionKind = "acc" | "branch" | "pc" | "output" | "memory" | "halt";

export interface ChallengeProgress {
  /** Times the tests were run. */
  readonly attempts: number;
  /** Runs with code different from the starter, which count towards seeing the solution. */
  readonly realAttempts: number;
  readonly solved: boolean;
  /** Best score for each measure, each kept on its own. */
  readonly best: Targets | null;
  readonly hintsShown: number;
  readonly solutionSeen: boolean;
  /** The learner's latest code. */
  readonly draft: string | null;
}

export interface Tally {
  readonly total: number;
  readonly correct: number;
}

export interface Progress {
  readonly challenges: Readonly<Record<string, ChallengeProgress>>;
  readonly predictions: Readonly<Record<PredictionKind, Tally>>;
  readonly lessons: Readonly<Record<string, { readonly completed: number }>>;
}

const KEY = "progress";
const ZERO: Tally = { total: 0, correct: 0 };

export const EMPTY_PROGRESS: Progress = {
  challenges: {},
  predictions: { acc: ZERO, branch: ZERO, pc: ZERO, output: ZERO, memory: ZERO, halt: ZERO },
  lessons: {},
};

export const EMPTY_CHALLENGE: ChallengeProgress = {
  attempts: 0,
  realAttempts: 0,
  solved: false,
  best: null,
  hintsShown: 0,
  solutionSeen: false,
  draft: null,
};

/** Fills in anything missing, so progress saved by an older version still loads. */
export function normaliseProgress(p: Partial<Progress> | null | undefined): Progress {
  return {
    challenges: Object.fromEntries(
      Object.entries(p?.challenges ?? {}).map(([id, c]) => [id, { ...EMPTY_CHALLENGE, ...c }]),
    ),
    predictions: { ...EMPTY_PROGRESS.predictions, ...(p?.predictions ?? {}) },
    lessons: { ...(p?.lessons ?? {}) },
  };
}

export async function getProgress(): Promise<Progress> {
  return normaliseProgress(await get<Progress>(RECORDS, KEY));
}

export async function setProgress(progress: Progress): Promise<void> {
  await put(RECORDS, progress, KEY);
}

// Writes run one after another, so two quick updates never overwrite each other.
let queue: Promise<unknown> = Promise.resolve();

export function updateProgress(change: (p: Progress) => Progress): Promise<Progress> {
  const next = queue.then(async () => {
    const updated = change(await getProgress());
    await setProgress(updated);
    return updated;
  });
  queue = next.catch(() => undefined);
  return next;
}

export function updateChallenge(
  id: string,
  change: (c: ChallengeProgress) => ChallengeProgress,
): Promise<Progress> {
  return updateProgress((p) => ({
    ...p,
    challenges: { ...p.challenges, [id]: change(p.challenges[id] ?? EMPTY_CHALLENGE) },
  }));
}

/** Keeps the lowest score for each measure. */
export function bestOf(a: Targets | null, b: Targets): Targets {
  if (!a) return b;
  return {
    instructions: Math.min(a.instructions, b.instructions),
    cycles: Math.min(a.cycles, b.cycles),
    mailboxes: Math.min(a.mailboxes, b.mailboxes),
  };
}

export function recordPrediction(kind: PredictionKind, correct: boolean): Promise<Progress> {
  return updateProgress((p) => {
    const t = p.predictions[kind];
    return {
      ...p,
      predictions: {
        ...p.predictions,
        [kind]: { total: t.total + 1, correct: t.correct + (correct ? 1 : 0) },
      },
    };
  });
}

export function completeLesson(slug: string): Promise<Progress> {
  return updateProgress((p) => ({
    ...p,
    lessons: { ...p.lessons, [slug]: { completed: Date.now() } },
  }));
}

export function accuracy(predictions: Progress["predictions"]): Tally {
  return Object.values(predictions).reduce(
    (sum, t) => ({ total: sum.total + t.total, correct: sum.correct + t.correct }),
    ZERO,
  );
}
