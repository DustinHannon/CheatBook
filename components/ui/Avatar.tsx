import React from 'react';
import { avatarTokens, initials as toInitials } from '../../lib/colors';

interface AvatarProps {
  name?: string | null;
  color?: string;
  avatarUrl?: string | null;
  size?: number;
  online?: boolean;
  ring?: boolean;
  className?: string;
}

/** Member avatar: photo if present, else colored initials. Optional teal online pip. */
export const Avatar: React.FC<AvatarProps> = ({
  name, color = '#6ea8fe', avatarUrl, size = 30, online, ring = true, className = '',
}) => {
  const t = avatarTokens(color);
  const fontSize = Math.max(9, Math.round(size * 0.36));
  const pip = Math.max(8, Math.round(size * 0.33));
  return (
    <div className={`relative flex-none ${className}`} style={{ width: size, height: size }}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name || ''}
          className="h-full w-full rounded-full object-cover"
          style={ring ? { boxShadow: `0 0 0 2px ${t.ring}` } : undefined}
        />
      ) : (
        <div
          className="grid h-full w-full place-items-center rounded-full font-mono font-bold"
          style={{
            color: t.color,
            background: t.bg,
            fontSize,
            boxShadow: ring ? `0 0 0 1.5px ${t.ring}` : undefined,
          }}
        >
          {toInitials(name)}
        </div>
      )}
      {online && (
        <span
          className="absolute rounded-full animate-cb-online"
          style={{
            bottom: -1, right: -1, width: pip, height: pip,
            background: '#5eead4', border: '2px solid #0c1119',
          }}
        />
      )}
    </div>
  );
};

export default Avatar;
