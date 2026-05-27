type QueryError = { message: string; code?: string };

export type QueryResult<T> = {
  data: T | null;
  error: QueryError | null;
};

export type QueryBuilder<T> = PromiseLike<QueryResult<T>> & {
  select(columns?: string, options?: { count?: "exact"; head?: boolean }): QueryBuilder<T>;
  insert(values: unknown): QueryBuilder<T>;
  update(values: unknown): QueryBuilder<T>;
  upsert(values: unknown, options?: { onConflict?: string }): QueryBuilder<T>;
  delete(): QueryBuilder<T>;
  eq(column: string, value: string | number | boolean | null): QueryBuilder<T>;
  in(column: string, values: readonly string[]): QueryBuilder<T>;
  not(column: string, operator: string, value: string): QueryBuilder<T>;
  neq(column: string, value: string | number | boolean | null): QueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  single(): Promise<QueryResult<T>>;
  maybeSingle(): Promise<QueryResult<T>>;
};

export type UntypedDatabaseClient = {
  from<T = unknown>(table: string): QueryBuilder<T>;
};

export function untypedDatabase(client: unknown): UntypedDatabaseClient {
  return client as UntypedDatabaseClient;
}
