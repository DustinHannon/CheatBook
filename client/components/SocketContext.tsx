import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';

// Create a context for Socket.IO
interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false
});

interface SocketProviderProps {
  children: React.ReactNode;
  userToken?: string;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children, userToken }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Only initialize socket if the user is authenticated
    if (!userToken) {
      return;
    }

    // Only initialize socket on the client side
    if (typeof window === 'undefined') {
      console.log('Socket.IO not initialized: Not on client side');
      return;
    }

    let socketIO;
    try {
      // Dynamically import socket.io-client only on the client side
      socketIO = require('socket.io-client');
      
      // Set up Socket.IO connection
      const socketInstance = socketIO(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', {
        auth: {
          token: userToken
        },
        withCredentials: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        autoConnect: true
      });

      // Event handlers
      socketInstance.on('connect', () => {
        console.log('Socket connected with ID:', socketInstance.id);
        setIsConnected(true);
      });

      socketInstance.on('disconnect', (reason: string) => {
        console.log('Socket disconnected:', reason);
        setIsConnected(false);
      });

      socketInstance.on('connect_error', (error: Error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);
      });

      // Store socket instance
      setSocket(socketInstance);

      // Clean up on unmount
      return () => {
        console.log('Cleaning up socket connection');
        socketInstance.disconnect();
      };
    } catch (error) {
      console.error('Error initializing Socket.IO:', error);
      return () => {};
    }
  }, [userToken]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

// Custom hook to use socket context
export const useSocket = () => useContext(SocketContext);

export default SocketContext;
