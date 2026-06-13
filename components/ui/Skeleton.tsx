import React from 'react';

/**
 * Glass shimmer placeholder block. Subtle white wash over the panel,
 * rounded, pulse animation. Use for any async surface's loading state.
 */
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    aria-hidden="true"
    className={`animate-cb-pulse rounded-lg bg-white/[0.05] ${className}`}
  />
);

/** Convenience: N shimmer lines for text-block placeholders. */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = '',
}) => (
  <div className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={i === lines - 1 ? 'h-3 w-2/3' : 'h-3'} />
    ))}
  </div>
);

export default Skeleton;
