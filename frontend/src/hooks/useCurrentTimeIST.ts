import { useState, useEffect } from 'react';
import { formatToIST, formatCustomIST } from '../utils/timezone';

export interface UseCurrentTimeISTOptions {
  format?: 'default' | '12h' | 'time' | 'full' | 'short' | 'long';
  intervalMs?: number;
}

/**
 * Custom React Hook for live updating IST time string
 * @param options configuration options for formatting and refresh rate
 * @returns Object with formatted IST time string and current Date
 */
export function useCurrentTimeIST(options: UseCurrentTimeISTOptions = {}) {
  const { format = 'default', intervalMs = 1000 } = options;

  const getFormatted = () => {
    if (format === 'default') return formatToIST(new Date());
    return formatCustomIST(new Date(), format);
  };

  const [currentTimeIST, setCurrentTimeIST] = useState<string>(getFormatted);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const updateClock = () => {
      const current = new Date();
      setNow(current);
      if (format === 'default') {
        setCurrentTimeIST(formatToIST(current));
      } else {
        setCurrentTimeIST(formatCustomIST(current, format));
      }
    };

    updateClock();
    const interval = setInterval(updateClock, intervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [format, intervalMs]);

  return {
    currentTimeIST,
    now,
    timeOnlyIST: formatCustomIST(now, 'time')
  };
}
