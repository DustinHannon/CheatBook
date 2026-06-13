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

export default Skeleton;
