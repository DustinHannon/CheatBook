import React from 'react';
import { hexToRgba } from '../CategoryBadge';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface CategoryChipsProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (categoryId: string | null) => void;
}

const CategoryChips: React.FC<CategoryChipsProps> = ({ categories, selectedId, onSelect }) => {
  return (
    <div className="flex gap-2 flex-wrap">
      {/* "All" chip */}
      <button
        onClick={() => onSelect(null)}
        className={`text-sm px-3 py-1.5 rounded-full transition-colors ${
          selectedId === null
            ? 'bg-bg-surface-active text-text-primary'
            : 'bg-bg-surface text-text-secondary hover:bg-bg-surface-hover'
        }`}
      >
        All
      </button>

      {/* Category chips */}
      {categories.map((category) => {
        const isSelected = selectedId === category.id;
        return (
          <button
            key={category.id}
            onClick={() => onSelect(category.id)}
            className={`text-sm px-3 py-1.5 rounded-full transition-colors ${
              !isSelected ? 'bg-bg-surface text-text-secondary hover:bg-bg-surface-hover' : ''
            }`}
            style={
              isSelected
                ? {
                    backgroundColor: hexToRgba(category.color, 0.2),
                    color: category.color,
                  }
                : undefined
            }
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
};

export default CategoryChips;
