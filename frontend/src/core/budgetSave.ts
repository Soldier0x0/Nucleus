export type BudgetShape = { monthly: number; categories: Record<string, number> };

/** True when saving `next` removes a monthly limit or a category limit that `prev` had. */
export function budgetCleared(prev: BudgetShape, next: BudgetShape): boolean {
  if (next.monthly <= 0 && prev.monthly > 0) return true;
  return Object.entries(prev.categories).some(([k, v]) => v > 0 && !next.categories[k]);
}
