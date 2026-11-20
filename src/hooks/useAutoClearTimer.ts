import { useCallback, useEffect, useRef, useState } from 'react';

export function useAutoClearState<T>(
  initialValue: T,
  delayMs = 2500,
): [T, (value: T) => void, () => void] {
  const [value, setValue] = useState<T>(initialValue);
  const timerRef = useRef<number | null>(null);
  const initialRef = useRef(initialValue);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setValue(initialRef.current);
  }, []);

  const trigger = useCallback(
    (next: T) => {
      setValue(next);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        setValue(initialRef.current);
        timerRef.current = null;
      }, delayMs);
    },
    [delayMs],
  );

  return [value, trigger, clear];
}
