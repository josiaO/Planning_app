declare module 'uuid' {
  /**
   * Generates a RFC4122 v4 UUID string.
   */
  export function v4(): string;

  // minimal extras in case other uuid helpers are used elsewhere
  export function v5(name: string, namespace: string): string;
}
