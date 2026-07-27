/**
 * Base class for identity-bearing domain objects. Equality is by identity
 * (id), not by structural value, matching standard DDD entity semantics.
 */
export abstract class Entity<TId> {
  protected constructor(public readonly id: TId) {}

  equals(other: Entity<TId>): boolean {
    return other instanceof Entity && this.id === other.id;
  }
}
