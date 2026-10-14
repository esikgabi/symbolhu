import { buildQueue, scoreRound, type Ask, type Rng, type RoundRecord } from "./rules";

/** One game: rounds of asks over the still-active characters. No timers, no DOM. */
export class GameSession {
  active: string[];
  round = 1;
  queue: string[];
  asks: Ask[] = []; // answers of the current round
  allAsks: Ask[] = []; // answers of the whole game
  rounds: RoundRecord[] = [];
  over: boolean;
  hitsPerChar: number;
  maxRounds: number;
  rng: Rng;

  constructor(cfg: { hitsPerChar: number; maxRounds: number }, readonly chars: string[], rng: Rng = Math.random) {
    this.hitsPerChar = cfg.hitsPerChar;
    this.maxRounds = cfg.maxRounds;
    this.rng = rng;
    this.active = [...chars];
    this.queue = buildQueue(this.active, this.hitsPerChar, rng);
    this.over = chars.length === 0;
  }

  get current(): string | undefined {
    return this.over ? undefined : this.queue[this.asks.length];
  }

  get mastered(): string[] {
    return this.rounds.flatMap((r) => r.mastered);
  }

  answer(hit: boolean): void {
    const char = this.current;
    if (char === undefined) return;
    const ask = { char, hit };
    this.asks.push(ask);
    this.allAsks.push(ask);
    if (this.asks.length === this.queue.length) this.endRound();
  }

  private endRound(): void {
    const rec = scoreRound(this.asks, this.active, this.hitsPerChar);
    this.rounds.push(rec);
    this.active = this.active.filter((c) => !rec.mastered.includes(c));
    if (this.active.length === 0 || this.round >= this.maxRounds) {
      this.over = true;
      return;
    }
    this.round++;
    this.asks = [];
    this.queue = buildQueue(this.active, this.hitsPerChar, this.rng);
  }
}
