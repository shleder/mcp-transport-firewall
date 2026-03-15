export class Histogram {
  private sum = 0;
  private count = 0;
  
  private buckets = new Map<number, number>();
  
  constructor(
    public readonly name: string, 
    public readonly help: string,
    public readonly bucketBounds: number[] = [10, 50, 100, 250, 500, 1000, 5000]
  ) {
    
    for (const bound of this.bucketBounds) {
      this.buckets.set(bound, 0);
    }
    this.buckets.set(Infinity, 0); 
  }

  observe(value: number): void {
    this.sum += value;
    this.count++;

    for (const bound of this.bucketBounds) {
      if (value <= bound) {
        this.buckets.set(bound, (this.buckets.get(bound) ?? 0) + 1);
        break;
      }
    }
    
    if (value > this.bucketBounds[this.bucketBounds.length - 1]) {
      this.buckets.set(Infinity, (this.buckets.get(Infinity) ?? 0) + 1);
    }
  }

  reset(): void {
    this.sum = 0;
    this.count = 0;
    for (const key of this.buckets.keys()) {
      this.buckets.set(key, 0);
    }
  }

  get(): { sum: number; count: number; avg: number; buckets: Record<string, number> } {
    const bucketsObj: Record<string, number> = {};
    for (const [bound, val] of this.buckets.entries()) {
      const key = bound === Infinity ? "+Inf" : String(bound);
      bucketsObj[key] = val;
    }

    return {
      sum: this.sum,
      count: this.count,
      avg: this.count > 0 ? this.sum / this.count : 0,
      buckets: bucketsObj,
    };
  }
}
