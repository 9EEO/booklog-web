export type TierKey = "S" | "A" | "B" | "C" | "D";
export type TierBoard = Record<TierKey, string[]>;

export const createEmptyTierBoard = (): TierBoard => ({
  S: [],
  A: [],
  B: [],
  C: [],
  D: [],
});
