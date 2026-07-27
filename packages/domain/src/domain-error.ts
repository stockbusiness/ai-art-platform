/**
 * Base class for domain-level errors. Business modules added in later PRs
 * should extend this rather than throwing plain Error or framework-specific
 * exception types, so the domain layer never imports NestJS/HTTP concerns.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
