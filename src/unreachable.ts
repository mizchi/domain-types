export class UnreachableError extends Error {}

export function unreachable(message?: string): never {
  throw new UnreachableError(
    `Unreachable: ${message ? message : "No additional message provided"}`
  );
}
