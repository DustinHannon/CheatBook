import React, { useMemo } from 'react';
import { Tooltip } from '@headlessui/react';

interface User {
  id: string;
  name: string;
  color: string;
  last_active: Date;
}

interface UserPresenceProps {
  user: User;
  size?: 'small' | 'medium' | 'large';
}

/**
 * UserPresence Component
 * Displays an avatar indicator for users collaborating on a note
 */
const UserPresence: React.FC<UserPresenceProps> = ({ 
  user, 
  size = 'medium' 
}) => {
  // Generate initial avatar for user if no image is available
  const initial = useMemo(() => {
    return user.name.charAt(0).toUpperCase();
  }, [user.name]);

  // Determine if user is currently active
  const isActive = useMemo(() => {
    const now = new Date();
    const lastActive = new Date(user.last_active);
    const differenceInSeconds = (now.getTime() - lastActive.getTime()) / 1000;
    return differenceInSeconds < 60; // Active if last seen less than a minute ago
  }, [user.last_active]);

  // Determine size of avatar based on prop
  const dimensions = useMemo(() => {
    switch (size) {
      case 'small':
        return {
          outer: 'w-6 h-6',
          inner: 'w-5 h-5',
          text: 'text-xs',
        };
      case 'large':
        return {
          outer: 'w-10 h-10',
          inner: 'w-9 h-9',
          text: 'text-base',
        };
      case 'medium':
      default:
        return {
          outer: 'w-8 h-8',
          inner: 'w-7 h-7',
          text: 'text-sm',
        };
    }
  }, [size]);

  return (
    <div className="relative mr-1 last:mr-0">
      <Tooltip>
        <Tooltip.Button className="focus:outline-none">
          <div className={`${dimensions.outer} rounded-full flex items-center justify-center relative`}>
            {/* Status indicator dot */}
            <div 
              className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background-primary ${
                isActive ? 'bg-success' : 'bg-gray-400'
              }`}
            />
            
            {/* User avatar circle */}
            <div 
              className={`${dimensions.inner} rounded-full flex items-center justify-center`} 
              style={{ backgroundColor: user.color }}
            >
              <span className={`${dimensions.text} font-medium text-white`}>
                {initial}
              </span>
            </div>
          </div>
        </Tooltip.Button>
        
        <Tooltip.Panel className="absolute z-10 bg-surface shadow-lg rounded p-2 text-sm text-text-primary">
          <div className="flex flex-col items-center">
            <span>{user.name}</span>
            <span className="text-xs text-text-tertiary">
              {isActive ? 'Currently editing' : 'Last active: ' + new Date(user.last_active).toLocaleTimeString()}
            </span>
          </div>
        </Tooltip.Panel>
      </Tooltip>
    </div>
  );
};

export default UserPresence; 