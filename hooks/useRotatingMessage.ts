import { useState, useEffect } from 'react';

export function useRotatingMessage(
  messages: string[],
  isActive: boolean,
  intervalMs: number = 1500
): string {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let intervalId: any;

    if (isActive && messages.length > 0) {
      intervalId = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % messages.length);
      }, intervalMs);
    } else {
      setCurrentIndex(0);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isActive, intervalMs, messages.length]);

  if (!messages || messages.length === 0) return '';
  return messages[currentIndex];
}