import React from 'react';
import {
  Server, Database, Cloud, Shield, Globe, Activity, Monitor, Terminal, Network,
  Lock, KeyRound, Mail, Calendar, Ticket, LifeBuoy, BookOpen, FileText, GitBranch,
  Boxes, Cpu, HardDrive, Wifi, Bell, Users, CreditCard, Building2, Phone, Wrench,
  Gauge, BarChart3, Folder, Link as LinkIcon, Briefcase, MessageSquare,
  type LucideIcon,
} from 'lucide-react';

// Curated icon set for portal categories + link cards. The row stores the string
// key; PortalIcon resolves it to a lucide component. Zero external requests, so the
// hardened CSP (no external img origins) stays intact.
export const PORTAL_ICONS: Record<string, LucideIcon> = {
  globe: Globe, server: Server, database: Database, cloud: Cloud, shield: Shield,
  activity: Activity, monitor: Monitor, terminal: Terminal, network: Network,
  lock: Lock, key: KeyRound, mail: Mail, calendar: Calendar, ticket: Ticket,
  lifebuoy: LifeBuoy, book: BookOpen, file: FileText, git: GitBranch, boxes: Boxes,
  cpu: Cpu, drive: HardDrive, wifi: Wifi, bell: Bell, users: Users, billing: CreditCard,
  building: Building2, phone: Phone, wrench: Wrench, gauge: Gauge, chart: BarChart3,
  folder: Folder, link: LinkIcon, briefcase: Briefcase, chat: MessageSquare,
};

export const PORTAL_ICON_KEYS = Object.keys(PORTAL_ICONS);

// Category / link color palette — extends the Spaces recolor swatches with two
// extra hues for more portal variety. Data-driven choices, not theme chrome.
export const PORTAL_PALETTE = [
  '#6ea8fe', '#5eead4', '#86efac', '#fb87a4', '#fbbf72', '#b794f6', '#7dd3fc', '#f0abfc',
];

export const PortalIcon: React.FC<{ name: string; size?: number; strokeWidth?: number }> = ({
  name, size = 18, strokeWidth = 1.8,
}) => {
  const Cmp = PORTAL_ICONS[name] || Globe;
  return <Cmp size={size} strokeWidth={strokeWidth} />;
};
