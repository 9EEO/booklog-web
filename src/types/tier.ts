export const tierKeys = ["S", "A", "B", "C", "D"] as const;

export type TierKey = (typeof tierKeys)[number];
export type TierBoard = Record<TierKey, string[]>;

export const createEmptyTierBoard = (): TierBoard => ({
  S: [],
  A: [],
  B: [],
  C: [],
  D: [],
});

export const normalizeTierBoard = (value: unknown): TierBoard => {
  const board = createEmptyTierBoard();
  if (!value || typeof value !== "object") return board;

  const source = value as Partial<Record<TierKey, unknown>>;
  const seenBookIds = new Set<string>();

  tierKeys.forEach((tier) => {
    const tierValue = source[tier];
    if (!Array.isArray(tierValue)) return;

    board[tier] = tierValue.filter((bookId): bookId is string => {
      if (typeof bookId !== "string" || seenBookIds.has(bookId)) return false;

      seenBookIds.add(bookId);
      return true;
    });
  });

  return board;
};
