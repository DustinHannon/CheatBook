import React, { useState, useRef, useEffect } from 'react';
import { PlusIcon, CheckIcon } from '@heroicons/react/24/outline';

interface Category {
  id: string;
  name: string;
  color: string;
}

interface CategoryPickerProps {
  noteId: string;
  currentCategories: Category[];
  allCategories: Category[];
  onToggle: (categoryId: string, isAdding: boolean) => void;
}

const CategoryPicker: React.FC<CategoryPickerProps> = ({
  noteId,
  currentCategories,
  allCategories,
  onToggle,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const currentIds = new Set(currentCategories.map((c) => c.id));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = (categoryId: string) => {
    const isAdding = !currentIds.has(categoryId);
    onToggle(categoryId, isAdding);
  };

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-xs text-text-tertiary hover:text-accent transition-colors px-2 py-1 rounded-md hover:bg-bg-surface-hover"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        <span>Add tag</span>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full mt-1 bg-bg-surface border border-border-default rounded-lg shadow-lg p-2 min-w-[200px] z-40"
        >
          {allCategories.length === 0 && (
            <p className="text-xs text-text-tertiary px-3 py-2">No categories available</p>
          )}
          {allCategories.map((category) => {
            const isAssigned = currentIds.has(category.id);
            return (
              <button
                key={category.id}
                onClick={() => handleToggle(category.id)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-bg-surface-hover cursor-pointer transition-colors"
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: category.color }}
                />
                <span className="text-sm text-text-body flex-1 text-left">{category.name}</span>
                {isAssigned && (
                  <CheckIcon className="h-4 w-4 text-accent shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CategoryPicker;
