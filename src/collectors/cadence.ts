export type CadenceKind = 'hot' | 'warm';

export class CadenceProfile {
  constructor(
    public readonly kind: CadenceKind,
    public readonly intervalMs: number
  ) {}

  public static hot(intervalMs: number): CadenceProfile {
    return new CadenceProfile('hot', intervalMs);
  }

  public static warm(intervalMs: number): CadenceProfile {
    return new CadenceProfile('warm', intervalMs);
  }
}
