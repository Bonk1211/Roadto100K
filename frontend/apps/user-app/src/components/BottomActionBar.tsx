import type { ReactNode } from 'react';

interface BottomActionBarProps {
  children: ReactNode;
  className?: string;
}

export default function BottomActionBar({
  children,
  className = '',
}: BottomActionBarProps) {
  return (
    <div className={['bottom-action-bar', className].join(' ').trim()}>
      {children}
    </div>
  );
}
