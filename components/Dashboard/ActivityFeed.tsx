import React from 'react';
import { SkeletonLine } from '../Skeleton';

interface ActivityLogEntry {
  id: string;
  action: string;
  target_title?: string | null;
  created_at: string;
  profiles?: { name?: string | null } | null;
  [key: string]: any;
}

interface ActivityFeedProps {
  activities: ActivityLogEntry[];
  isLoading: boolean;
}

const ACTION_VERBS: Record<string, string> = {
  created_note: 'created',
  edited_note: 'edited',
  deleted_note: 'deleted',
  locked_note: 'locked',
  unlocked_note: 'unlocked',
  created_notebook: 'created notebook',
};

function formatActivityTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 1) {
    return `${diffDay}d ago`;
  } else if (diffDay === 1) {
    return 'Yesterday';
  } else if (diffHour > 0) {
    return `${diffHour}h ago`;
  } else if (diffMin > 0) {
    return `${diffMin}m ago`;
  } else {
    return 'Just now';
  }
}

function getInitial(name: string): string {
  return name ? name.charAt(0).toUpperCase() : '?';
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities, isLoading }) => {
  return (
    <section>
      <span className="section-label">TEAM ACTIVITY</span>
      <div className="mt-3 max-h-[400px] overflow-y-auto space-y-1">
        {isLoading ? (
          <>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2">
                <div className="w-7 h-7 rounded-full bg-bg-surface-hover animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5 pt-0.5">
                  <SkeletonLine width="80%" height="0.875rem" />
                  <SkeletonLine width="30%" height="0.75rem" />
                </div>
              </div>
            ))}
          </>
        ) : activities.length === 0 ? (
          <p className="text-xs text-text-tertiary px-3 py-2">No recent activity</p>
        ) : (
          activities.map((activity) => {
            const verb = ACTION_VERBS[activity.action] || activity.action;
            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 px-3 py-2 rounded-lg"
              >
                <div className="w-7 h-7 rounded-full bg-accent-muted flex items-center justify-center shrink-0">
                  <span className="text-xs font-medium text-accent">
                    {getInitial(activity.profiles?.name || 'Unknown')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-secondary">
                    <span className="text-text-primary font-medium">{activity.profiles?.name || 'Unknown'}</span>
                    {' '}{verb}{' '}
                    {activity.target_title && (
                      <span className="text-accent">{activity.target_title}</span>
                    )}
                  </p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {formatActivityTime(activity.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

export default ActivityFeed;
