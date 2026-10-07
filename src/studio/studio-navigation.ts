/**
 * FuryPipe Local information architecture.
 *
 * The shell owns navigation; each view keeps its existing runtime contract.
 * Levels are progressive disclosure gates, not permissions. A hidden entry is
 * still reachable from the command palette after the viewer changes mode.
 */

export type StudioNavigationLevel = 'simple' | 'power' | 'engineer' | 'expert';

export interface StudioNavigationItem {
  readonly view: string;
  readonly label: string;
  readonly level: StudioNavigationLevel;
}

export interface StudioNavigationSection {
  readonly key: string;
  readonly label: string;
  readonly items: readonly StudioNavigationItem[];
}

export const STUDIO_PRIMARY_NAVIGATION = Object.freeze([
  { view: 'workspace', label: 'Workspace', level: 'simple' },
  { view: 'chat', label: 'Chat', level: 'simple' },
  { view: 'video', label: 'Video', level: 'power' },
  { view: 'cowork', label: 'Work', level: 'power' },
  { view: 'code', label: 'Code', level: 'engineer' },
  { view: 'agents', label: 'Agents', level: 'engineer' },
  { view: 'autopilot', label: 'Autopilot', level: 'power' },
] as const satisfies readonly StudioNavigationItem[]);

export const STUDIO_NAVIGATION_SECTIONS = Object.freeze([
  {
    key: 'explore',
    label: 'Explore',
    items: [
      { view: 'models', label: 'Models', level: 'simple' },
      { view: 'media', label: 'Media', level: 'power' },
      { view: 'knowledge', label: 'Knowledge', level: 'power' },
      { view: 'web', label: 'Web', level: 'power' },
      { view: 'memory', label: 'Memory', level: 'power' },
    ],
  },
  {
    key: 'operate',
    label: 'Operate',
    items: [
      { view: 'artifacts', label: 'Artifacts', level: 'power' },
      { view: 'automations', label: 'Automations', level: 'engineer' },
      { view: 'observability', label: 'Observability', level: 'engineer' },
      { view: 'mission', label: 'Mission Control', level: 'expert' },
    ],
  },
  {
    key: 'connect',
    label: 'Connect',
    items: [
      { view: 'connections', label: 'Connections', level: 'simple' },
      { view: 'runtimes', label: 'Runtimes', level: 'engineer' },
      { view: 'skills', label: 'Skills', level: 'power' },
      { view: 'mcp', label: 'MCP', level: 'power' },
      { view: 'extensions', label: 'Extensions', level: 'power' },
      { view: 'integrations', label: 'Integrations', level: 'engineer' },
      { view: 'marketplace', label: 'Marketplace', level: 'power' },
    ],
  },
  {
    key: 'system',
    label: 'System',
    items: [
      { view: 'support', label: 'Support', level: 'simple' },
    ],
  },
] as const satisfies readonly StudioNavigationSection[]);
