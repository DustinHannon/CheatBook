import React from 'react';

interface SkeletonLineProps {
  width?: string;
  height?: string;
  className?: string;
}

export const SkeletonLine: React.FC<SkeletonLineProps> = ({
  width = '100%',
  height = '1rem',
  className = '',
}) => {
  return (
    <div
      className={`rounded bg-bg-surface-hover animate-pulse ${className}`}
      style={{ width, height }}
    />
  );
};

export const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-bg-raised border border-border-subtle rounded-lg p-5 animate-pulse">
      <SkeletonLine width="60%" height="1.25rem" />
      <SkeletonLine width="100%" height="0.875rem" className="mt-3" />
      <SkeletonLine width="80%" height="0.875rem" className="mt-2" />
      <div className="flex items-center justify-between mt-4">
        <SkeletonLine width="30%" height="0.75rem" />
        <SkeletonLine width="20%" height="0.75rem" />
      </div>
    </div>
  );
};

interface SkeletonAvatarProps {
  size?: number;
}

export const SkeletonAvatar: React.FC<SkeletonAvatarProps> = ({ size = 40 }) => {
  return (
    <div
      className="rounded-full bg-bg-surface-hover animate-pulse shrink-0"
      style={{ width: size, height: size }}
    />
  );
};
