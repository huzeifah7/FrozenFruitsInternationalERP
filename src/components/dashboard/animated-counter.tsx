import React, { useEffect, useState, useRef } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  formatter?: (val: number) => string;
}

export function AnimatedCounter({ value, duration = 1000, formatter }: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const previousValueRef = useRef(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = previousValueRef.current;
    const endValue = value;
    
    if (startValue === endValue) {
      setCount(endValue);
      return;
    }

    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Easing out quad function for smooth deceleration
      const easeProgress = progress * (2 - progress);
      
      const currentCount = easeProgress * (endValue - startValue) + startValue;
      setCount(currentCount);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        setCount(endValue);
        previousValueRef.current = endValue;
      }
    };

    animationFrameId = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [value, duration]);

  const displayVal = formatter ? formatter(count) : Math.floor(count).toLocaleString();
  return <span>{displayVal}</span>;
}
