/// Small deterministic PRNG so stub generation is repeatable per brief while
/// still producing visibly different sites for different businesses.
export function hashString(value: string): number {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

export class SeededRandom {
  private state: number

  constructor(seed: string) {
    this.state = hashString(seed) || 1
  }

  next(): number {
    this.state ^= this.state << 13
    this.state ^= this.state >>> 17
    this.state ^= this.state << 5
    this.state >>>= 0
    return this.state / 0xffffffff
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty list')
    }

    return items[Math.floor(this.next() * items.length) % items.length] as T
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability
  }
}
