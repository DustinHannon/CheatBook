import React, { useCallback, useEffect, useRef } from 'react';
import { useSocket } from './SocketContext';

interface ImagePasteProps {
  children: React.ReactNode;
  onImagePaste?: (file: File, cursorPosition: number) => Promise<void>;
  cursorPosition: number;
}

/**
 * ImagePaste Component
 * Handles image paste events and passes them to the editor
 */
const ImagePaste: React.FC<ImagePasteProps> = ({
  children,
  onImagePaste,
  cursorPosition,
}) => {
  const { socket, isConnected } = useSocket();
  
  // Handle paste events
  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      // Check if we have clipboard data and if there's an image
      const items = event.clipboardData?.items;
      if (!items || !onImagePaste) return;

      // Look for images in the pasted content
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Check if the item is an image
        if (item.type.indexOf('image') === 0) {
          // Get the image file
          const file = item.getAsFile();
          if (!file) continue;
          
          // Process file
          try {
            await onImagePaste(file, cursorPosition);
          } catch (error) {
            console.error('Error processing pasted image:', error);
          }
          
          // Prevent default behavior to avoid double paste
          event.preventDefault();
          break;
        }
      }
    },
    [onImagePaste, cursorPosition]
  );

  // Add and remove the paste event listener
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);

  return <>{children}</>;
};

export default ImagePaste;
