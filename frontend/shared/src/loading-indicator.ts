import { createElement, useEffect, useId, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

type LoadingTone = 'inherit' | 'primary' | 'inverse' | 'muted';
type LoadingSize = 'sm' | 'md';

interface LoadingDotsProps {
  label?: ReactNode;
  tone?: LoadingTone;
  size?: LoadingSize;
  centered?: boolean;
}

const TONE_COLOR: Record<LoadingTone, string> = {
  inherit: 'currentColor',
  primary: '#005BAC',
  inverse: '#FFFFFF',
  muted: '#6B7280',
};

const SIZE_MAP: Record<LoadingSize, { dot: number; gap: number; lift: number; text: number }> = {
  sm: { dot: 6, gap: 4, lift: 4, text: 13 },
  md: { dot: 8, gap: 6, lift: 5, text: 14 },
};

export function LoadingDots({
  label,
  tone = 'inherit',
  size = 'md',
  centered = false,
}: LoadingDotsProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const id = useId();
  const config = SIZE_MAP[size];

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % 3);
    }, 180);

    return () => window.clearInterval(intervalId);
  }, []);

  const wrapperStyle: CSSProperties = {
    alignItems: 'center',
    color: TONE_COLOR[tone],
    display: 'inline-flex',
    fontSize: config.text,
    fontWeight: 600,
    gap: 8,
    justifyContent: centered ? 'center' : undefined,
    width: centered ? '100%' : undefined,
  };

  const dotsStyle: CSSProperties = {
    alignItems: 'flex-end',
    display: 'inline-flex',
    gap: config.gap,
    height: config.dot + config.lift,
  };

  return createElement(
    'span',
    {
      'aria-live': 'polite',
      'aria-busy': true,
      'data-loading-dots': true,
      role: 'status',
      style: wrapperStyle,
    },
    label ? createElement('span', { id }, label) : null,
    createElement(
      'span',
      {
        'aria-hidden': true,
        style: dotsStyle,
      },
      [0, 1, 2].map((dotIndex) =>
        createElement('span', {
          key: dotIndex,
          style: {
            backgroundColor: 'currentColor',
            borderRadius: 999,
            display: 'inline-block',
            height: config.dot,
            opacity: activeIndex === dotIndex ? 1 : 0.38,
            transform: activeIndex === dotIndex ? `translateY(-${config.lift}px)` : 'translateY(0px)',
            transition: 'transform 180ms ease, opacity 180ms ease',
            width: config.dot,
          },
        }),
      ),
    ),
  );
}
