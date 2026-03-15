import { InFlightDeduplicator } from "../utils/async.js";

const globalDeduplicator = new InFlightDeduplicator<unknown>();

export async function withDeduplication<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  return globalDeduplicator.execute(key, fn) as Promise<T>;
}
