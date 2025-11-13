import { useEffect } from "react";

const WAKE_LOCK_SUPPORTED =
  typeof navigator !== "undefined" && typeof navigator.wakeLock?.request === "function";

const USER_INTERACTION_EVENTS: Array<keyof DocumentEventMap> = ["pointerup", "touchend", "keydown"];

const useScreenWakeLock = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled || typeof document === "undefined" || typeof navigator === "undefined") {
      return undefined;
    }

    if (!WAKE_LOCK_SUPPORTED) {
      return undefined;
    }

    let wakeLock: WakeLockSentinel | null = null;
    let cancelled = false;
    let awaitingInteraction = false;

    const handleRelease = () => {
      if (cancelled || document.visibilityState !== "visible") {
        return;
      }
      void requestWakeLock();
    };

    const cleanupInteractionListeners = () => {
      if (!awaitingInteraction) {
        return;
      }
      awaitingInteraction = false;
      USER_INTERACTION_EVENTS.forEach((eventName) => {
        document.removeEventListener(eventName, handleUserInteraction);
      });
    };

    const handleUserInteraction = () => {
      cleanupInteractionListeners();
      if (!cancelled) {
        void requestWakeLock();
      }
    };

    const addInteractionListeners = () => {
      if (awaitingInteraction) {
        return;
      }
      awaitingInteraction = true;
      USER_INTERACTION_EVENTS.forEach((eventName) => {
        document.addEventListener(eventName, handleUserInteraction, { once: true, passive: true });
      });
    };

    const releaseWakeLock = async () => {
      if (!wakeLock) {
        return;
      }
      wakeLock.removeEventListener("release", handleRelease);
      try {
        await wakeLock.release();
      } catch {
        // Swallow release errors; the wake lock is already gone.
      }
      wakeLock = null;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      } else {
        void releaseWakeLock();
      }
    };

    async function requestWakeLock() {
      if (cancelled || document.visibilityState !== "visible" || !navigator.wakeLock?.request) {
        return;
      }
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        cleanupInteractionListeners();
        wakeLock = sentinel;
        wakeLock.addEventListener("release", handleRelease);
      } catch (error) {
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          addInteractionListeners();
          return;
        }
        // eslint-disable-next-line no-console
        console.warn("Unable to request screen wake lock", error);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    void requestWakeLock();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cleanupInteractionListeners();
      void releaseWakeLock();
    };
  }, [enabled]);
};

export default useScreenWakeLock;
