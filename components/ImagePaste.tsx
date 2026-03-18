import React, { useCallback, useEffect } from 'react';

interface ImagePasteProps {
  children: React.ReactNode;
  onImagePaste?: (file: File, cursorPosition: number) => Promise<void>;
  cursorPosition: number;
}

const ImagePaste: React.FC<ImagePasteProps> = ({
  children,
  onImagePaste,
  cursorPosition,
}) => {
  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items || !onImagePaste) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') === 0) {
          const file = item.getAsFile();
          if (!file) continue;

          try {
            await onImagePaste(file, cursorPosition);
          } catch (error) {
            console.error('Error processing pasted image:', error);
          }
          event.preventDefault();
          break;
        }
      }
    },
    [onImagePaste, cursorPosition]
  );

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  return <>{children}</>;
};

export default ImagePaste;
