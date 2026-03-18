import React, { useEffect, useState, useRef } from 'react';

interface FloatingToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  onToggleInlineStyle: (style: string) => void;
  onToggleBlockType: (blockType: string) => void;
  currentInlineStyles: Set<string>;
  currentBlockType: string;
  isVisible: boolean;
}

const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  editorRef,
  onToggleInlineStyle,
  onToggleBlockType,
  currentInlineStyles,
  currentBlockType,
  isVisible,
}) => {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible) {
      setPosition(null);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setPosition(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const editorRect = editorRef.current?.getBoundingClientRect();

    if (!editorRect || rect.width === 0) {
      setPosition(null);
      return;
    }

    const toolbarWidth = toolbarRef.current?.offsetWidth || 320;
    let left = rect.left + rect.width / 2 - toolbarWidth / 2;

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - toolbarWidth - 8));

    setPosition({
      top: rect.top - 48,
      left,
    });
  }, [isVisible, editorRef]);

  if (!isVisible || !position) return null;

  const buttons = [
    { style: 'BOLD', label: 'B', className: 'font-bold', type: 'inline' },
    { style: 'ITALIC', label: 'I', className: 'italic', type: 'inline' },
    { style: 'UNDERLINE', label: 'U', className: 'underline', type: 'inline' },
    { type: 'divider' },
    { style: 'header-one', label: 'H1', className: 'text-xs', type: 'block' },
    { style: 'header-two', label: 'H2', className: 'text-xs', type: 'block' },
    { type: 'divider' },
    { style: 'unordered-list-item', label: '\u2022', className: '', type: 'block' },
    { style: 'ordered-list-item', label: '1.', className: 'text-xs', type: 'block' },
  ];

  const isActive = (btn: typeof buttons[0]) => {
    if (btn.type === 'inline') return currentInlineStyles.has(btn.style!);
    if (btn.type === 'block') return currentBlockType === btn.style;
    return false;
  };

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 animate-fade-in"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-center gap-0.5 bg-bg-surface border border-border-emphasis rounded-lg px-1.5 py-1 shadow-lg">
        {buttons.map((btn, i) => {
          if (btn.type === 'divider') {
            return <div key={i} className="w-px h-5 bg-border-default mx-1" />;
          }
          return (
            <button
              key={btn.style}
              onMouseDown={(e) => {
                e.preventDefault();
                if (btn.type === 'inline') onToggleInlineStyle(btn.style!);
                else onToggleBlockType(btn.style!);
              }}
              className={`px-2 py-1 rounded text-sm transition-colors ${btn.className} ${
                isActive(btn)
                  ? 'text-accent bg-accent-muted'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface-hover'
              }`}
            >
              {btn.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FloatingToolbar;
