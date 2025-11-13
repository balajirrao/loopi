export {};

declare global {
  interface WakeLockSentinel extends EventTarget {
    readonly released: boolean;
    readonly type: "screen";
    release(): Promise<void>;
  }

  interface WakeLock {
    request(type: "screen"): Promise<WakeLockSentinel>;
  }

  interface Navigator {
    wakeLock?: WakeLock;
  }
}
