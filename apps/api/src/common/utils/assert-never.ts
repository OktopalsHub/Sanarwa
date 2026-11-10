export function assertNever(value: never): never {
  throw new Error(`Unsupported value: ${String(value)}`);
}
