// Bounded per-process foundation. Deployment-wide edge and direct RPC controls
// remain required before public launch; memory is not a distributed limiter.
export class RateWindow {
  private entries = new Map<string, { count: number; until: number }>();
  constructor(
    private limit: number,
    private windowMs: number,
    private capacity = 5000,
  ) {}
  allow(key: string, now = Date.now()) {
    const previous = this.entries.get(key);
    const entry =
      previous && previous.until > now
        ? previous
        : { count: 0, until: now + this.windowMs };
    entry.count++;
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.capacity)
      this.entries.delete(this.entries.keys().next().value!);
    return entry.count <= this.limit;
  }
}
