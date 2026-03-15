export class Counter {
  private count = 0;

  constructor(public readonly name: string, public readonly help: string) {}

  inc(value = 1): void {
    if (value < 0) {
      throw new Error(`Counter ${this.name} не поддерживает отрицательные инкременты.`);
    }
    this.count += value;
  }

  reset(): void {
    this.count = 0;
  }

  get(): number {
    return this.count;
  }
}
