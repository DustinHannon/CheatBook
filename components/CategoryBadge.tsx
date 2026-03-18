import React from 'react';

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface CategoryBadgeProps {
  name: string;
  color: string;
  size?: 'sm' | 'md';
}

const CategoryBadge: React.FC<CategoryBadgeProps> = ({ name, color, size = 'sm' }) => {
  const sizeClasses = size === 'sm'
    ? 'text-xs px-2 py-0.5 rounded-full'
    : 'text-sm px-2.5 py-1 rounded-full';

  return (
    <span
      className={`${sizeClasses} inline-block font-body`}
      style={{
        backgroundColor: hexToRgba(color, 0.15),
        color: color,
      }}
    >
      {name}
    </span>
  );
};

export { hexToRgba };
export default CategoryBadge;
