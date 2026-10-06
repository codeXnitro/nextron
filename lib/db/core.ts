import type {
  DatabaseDoc,
  DualResult,
  PaginatedResult,
  QueryFilter,
  QueryOptions,
} from "./types";

export function generateId(prefix = "doc"): string {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${time}_${rand}`;
}

export function makeDualResult<T>(value: T, promisePromise?: Promise<any>): DualResult<T> {
  const promise = promisePromise || Promise.resolve(value);

  if (typeof value === "object" && value !== null) {
    const obj = value as any;
    obj.then = (onFulfilled?: any, onRejected?: any) =>
      promise.then(() => onFulfilled?.(value), onRejected);
    obj.catch = (onRejected?: any) => promise.catch(onRejected);
    obj.finally = (onFinally?: any) => promise.finally(onFinally);
    return obj as DualResult<T>;
  }

  // Primitive return type (e.g. boolean, number) wrapped as a Boxed Primitive with Thenable
  const boxed = (typeof value === "boolean"
    ? new Boolean(value)
    : typeof value === "number"
    ? new Number(value)
    : new String(value)) as any;

  boxed.valueOf = () => value;
  boxed.toString = () => String(value);
  boxed.then = (onFulfilled?: any, onRejected?: any) =>
    promise.then(() => onFulfilled?.(value), onRejected);
  boxed.catch = (onRejected?: any) => promise.catch(onRejected);
  boxed.finally = (onFinally?: any) => promise.finally(onFinally);

  return boxed as DualResult<T>;
}

export function matchesCondition(actual: any, condition: any): boolean {
  if (condition === undefined) return true;

  if (
    typeof condition === "object" &&
    condition !== null &&
    !Array.isArray(condition) &&
    !(condition instanceof Date)
  ) {
    const keys = Object.keys(condition);
    const hasOperators = keys.some((k) => k.startsWith("$"));

    if (hasOperators) {
      for (const [op, val] of Object.entries(condition)) {
        switch (op) {
          case "$eq":
            if (actual !== val) return false;
            break;
          case "$ne":
            if (actual === val) return false;
            break;
          case "$gt":
            if (!(actual > (val as any))) return false;
            break;
          case "$gte":
            if (!(actual >= (val as any))) return false;
            break;
          case "$lt":
            if (!(actual < (val as any))) return false;
            break;
          case "$lte":
            if (!(actual <= (val as any))) return false;
            break;
          case "$in":
            if (!Array.isArray(val) || !val.includes(actual)) return false;
            break;
          case "$nin":
            if (Array.isArray(val) && val.includes(actual)) return false;
            break;
          case "$contains":
            if (
              typeof actual !== "string" ||
              !actual.toLowerCase().includes(String(val).toLowerCase())
            )
              return false;
            break;
          case "$startsWith":
            if (
              typeof actual !== "string" ||
              !actual.toLowerCase().startsWith(String(val).toLowerCase())
            )
              return false;
            break;
          case "$regex": {
            const regex =
              typeof val === "string" ? new RegExp(val, "i") : (val as RegExp);
            if (!regex.test(String(actual ?? ""))) return false;
            break;
          }
          default:
            break;
        }
      }
      return true;
    }
  }

  return actual === condition;
}

export function matchesFilter<T>(item: T, filter?: QueryFilter<T>): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;

  // Full-text search across string/number values
  if (filter._search && typeof filter._search === "string") {
    const term = filter._search.toLowerCase().trim();
    if (term) {
      const matchFound = Object.values(item as Record<string, any>).some((val) => {
        if (typeof val === "string") return val.toLowerCase().includes(term);
        if (typeof val === "number") return String(val).includes(term);
        return false;
      });
      if (!matchFound) return false;
    }
  }

  for (const [key, expected] of Object.entries(filter)) {
    if (key.startsWith("_")) continue;
    const actual = (item as Record<string, any>)[key];
    if (!matchesCondition(actual, expected)) return false;
  }

  return true;
}

export function sortItems<T>(
  items: T[],
  sortField?: string,
  order: "asc" | "desc" = "asc"
): T[] {
  if (!sortField) return items;
  return [...items].sort((a, b) => {
    const valA = (a as Record<string, any>)[sortField];
    const valB = (b as Record<string, any>)[sortField];
    if (valA === valB) return 0;
    if (valA === undefined || valA === null) return 1;
    if (valB === undefined || valB === null) return -1;
    const comparison = valA < valB ? -1 : 1;
    return order === "desc" ? -comparison : comparison;
  });
}

export function paginateItems<T>(
  items: T[],
  page = 1,
  limit = 10
): PaginatedResult<T> {
  const total = items.length;
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const skip = (safePage - 1) * safeLimit;

  return {
    items: items.slice(skip, skip + safeLimit),
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}
