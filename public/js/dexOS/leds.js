export function createLeds(ledEls = []) {
  const ledTimers = new Map();

  const set = (index, state) => {
    const el = ledEls?.[index];
    if (!el) return;
    el.classList.toggle('active', !!state);
  };

  const pulse = (index, pattern = {}) => {
    const { interval = 400 } = pattern;
    const el = ledEls?.[index];
    if (!el) return () => {};
    const existing = ledTimers.get(index);
    if (existing) clearInterval(existing);
    let on = false;
    const timer = setInterval(() => {
      on = !on;
      set(index, on);
    }, interval);
    ledTimers.set(index, timer);
    return () => {
      clearInterval(timer);
      ledTimers.delete(index);
      set(index, false);
    };
  };

  const flashTimes = (index, times = 3, interval = 220) => {
    const existing = ledTimers.get(index);
    if (existing) clearInterval(existing);
    let count = 0;
    const timer = setInterval(() => {
      const on = count % 2 === 0;
      set(index, on);
      count += 1;
      if (count >= times * 2) {
        clearInterval(timer);
        ledTimers.delete(index);
        set(index, false);
      }
    }, interval);
    ledTimers.set(index, timer);
  };

  const clearAll = () => {
    ledTimers.forEach((timer) => clearInterval(timer));
    ledTimers.clear();
    ledEls.forEach((_, index) => set(index, false));
  };

  return {
    set,
    pulse,
    flashTimes,
    clearAll,
  };
}
