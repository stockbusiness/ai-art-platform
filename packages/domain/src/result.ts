/**
 * Discriminated-union result type for representing domain operations that
 * can fail without throwing. Keeping this framework-free (no exceptions,
 * no dependency on any HTTP or ORM types) is what lets `domain` stay usable
 * from NestJS controllers, Worker jobs, or plain scripts alike.
 */
export type Result<TValue, TError> =
  { readonly ok: true; readonly value: TValue } | { readonly ok: false; readonly error: TError };

export function ok<TValue>(value: TValue): Result<TValue, never> {
  return { ok: true, value };
}

export function err<TError>(error: TError): Result<never, TError> {
  return { ok: false, error };
}

export function isOk<TValue, TError>(
  result: Result<TValue, TError>,
): result is { ok: true; value: TValue } {
  return result.ok;
}

export function isErr<TValue, TError>(
  result: Result<TValue, TError>,
): result is { ok: false; error: TError } {
  return !result.ok;
}

export function mapResult<TValue, TError, TMapped>(
  result: Result<TValue, TError>,
  mapper: (value: TValue) => TMapped,
): Result<TMapped, TError> {
  if (result.ok) {
    return ok(mapper(result.value));
  }
  return err(result.error);
}
