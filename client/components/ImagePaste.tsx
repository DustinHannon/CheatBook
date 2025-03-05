import React, { useCallback, useEffect, useState } from 'react';

interface ImagePasteProps {
  onImagePaste: (file: File, cursorPosition: number) => Promise<void>;
  disabled?: boolean;
  children: React.ReactNode;
  cursorPosition?: number;
}

/**
 * ImagePaste Component
 * Wrapper component that captures paste events with images
 * and provides the image data to a callback function
 */
const ImagePaste: React.FC<ImagePasteProps> = ({ 
  onImagePaste, 
  disabled = false, 
  children,
  cursorPosition = 0
}) => {
  const [isPasting, setIsPasting] = useState(false);

  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      if (disabled || isPasting) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      // Look for image items in the clipboard
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') === 0) {
          e.preventDefault();
          const file = items[i].getAsFile();
          
          if (file) {
            try {
              setIsPasting(true);
              // Pass cursor position for collaborative editing
              await onImagePaste(file, cursorPosition);
            } catch (error) {
              console.error('Error pasting image:', error);
            } finally {
              setIsPasting(false);
            }
          }
          break;
        }
      }
    },
    [disabled, isPasting, onImagePaste, cursorPosition]
  );

  useEffect(() => {
    // Add and remove the paste event listener
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  return (
    <div className="relative w-full h-full">
      {children}
      
      {/* Overlay when pasting */}
      {isPasting && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <div className="flex items-center space-x-2">
              <svg 
                className="animate-spin h-5 w-5 text-primary" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24"
              >
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-text-primary">Uploading image...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImagePaste; 