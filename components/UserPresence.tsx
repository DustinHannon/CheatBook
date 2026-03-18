import React, { useMemo, useState } from 'react';

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

const UserPresence: React.FC<UserPresenceProps> = ({ user, size = 'medium' }) => {
  const initial = useMemo(() => user.name.charAt(0).toUpperCase(), [user.name]);

  const isActive = useMemo(() => {
    const diff = (new Date().getTime() - new Date(user.last_active).getTime()) / 1000;
    return diff < 60;
  }, [user.last_active]);

  const dims = useMemo(() => {
    switch (size) {
      case 'small': return { outer: 'w-6 h-6', inner: 'w-5 h-5', text: 'text-[10px]', dot: 'w-2 h-2' };
      case 'large': return { outer: 'w-10 h-10', inner: 'w-9 h-9', text: 'text-base', dot: 'w-3 h-3' };
      default: return { outer: 'w-8 h-8', inner: 'w-7 h-7', text: 'text-sm', dot: 'w-2.5 h-2.5' };
    }
  }, [size]);

  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="relative mr-1 last:mr-0"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={`${dims.outer} rounded-full flex items-center justify-center relative`}>
        <div className={`absolute -top-0.5 -right-0.5 ${dims.dot} rounded-full border-2 border-bg-base ${
          isActive ? 'bg-status-success' : 'bg-text-disabled'
        }`} />
        <div
          className={`${dims.inner} rounded-full flex items-center justify-center`}
          style={{ backgroundColor: user.color }}
        >
          <span className={`${dims.text} font-medium text-white`}>{initial}</span>
        </div>
      </div>

      {showTooltip && (
        <div className="absolute z-50 bg-bg-surface border border-border-default shadow-lg rounded-lg px-3 py-2 text-sm text-text-primary -translate-x-1/2 left-1/2 mt-1 whitespace-nowrap">
          <span className="font-medium">{user.name}</span>
          <div className="text-xs text-text-tertiary mt-0.5">
            {isActive ? 'Editing now' : `Last active ${new Date(user.last_active).toLocaleTimeString()}`}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserPresence;
