/**
 * FuryPipe Local information architecture.
 *
 * Daily navigation stays small: Chat and Projects. Technical capabilities
 * remain reachable through the command palette, contextual workspaces and
 * Settings. This map contains no user modes and grants no authority.
 */

export type StudioNavigationGroup = 'workspace' | 'models' | 'work' | 'developer' | 'settings';

export interface StudioNavigationItem {
  readonly view: string;
  readonly label: string;
  readonly group: StudioNavigationGroup;
  readonly description?: string;
}

export interface StudioNavigationSection {
  readonly key: string;
  readonly label: string;
  readonly items: readonly StudioNavigationItem[];
}

export const STUDIO_PRIMARY_NAVIGATION = Object.freeze([
  { view: 'chat', label: 'Chat', group: 'workspace', description: 'Ask FuryPipe for anything.' },
  { view: 'projects', label: 'Projects', group: 'workspace', description: 'Keep conversations and local context together.' },
] as const satisfies readonly StudioNavigationItem[]);

/**
 * Discoverable routes are intentionally not rendered in the daily sidebar.
 * Command palette, contextual panels and Settings expose them when relevant.
 */
export const STUDIO_NAVIGATION_SECTIONS: readonly StudioNavigationSection[] = Object.freeze([
  {
    key: 'models',
    label: 'AI & models',
    items: [
      { view: 'models', label: 'AI & models', group: 'models', description: 'Connected, detected and local model runtimes.' },
      { view: 'connections', label: 'Connections', group: 'models', description: 'Connect an AI through its official local flow.' },
    ],
  },
  {
    key: 'work',
    label: 'Contextual workspaces',
    items: [
      { view: 'code', label: 'Code workspace', group: 'work', description: 'Open when a coding task needs files, diff or tests.' },
      { view: 'artifacts', label: 'Artifacts', group: 'work', description: 'Inspect versioned outputs in context.' },
      { view: 'knowledge', label: 'Knowledge', group: 'work', description: 'Search indexed project sources.' },
      { view: 'media', label: 'Media workspace', group: 'work', description: 'Preview image, video and audio work.' },
      { view: 'research', label: 'Research workspace', group: 'work', description: 'Sources, pages, citations and progress.' },
    ],
  },
  {
    key: 'developer',
    label: 'Developer',
    items: [
      { view: 'agents', label: 'Agent activity', group: 'developer', description: 'Visible only while agents work.' },
      { view: 'automations', label: 'Automations', group: 'developer', description: 'Create and inspect natural-language automations.' },
      { view: 'memory', label: 'Memory', group: 'developer', description: 'Inspect project memory.' },
      { view: 'mcp', label: 'MCP', group: 'developer', description: 'Governed MCP sources and tools.' },
      { view: 'extensions', label: 'Tools & extensions', group: 'developer', description: 'Skills, plugins, extensions and MCP Apps.' },
      { view: 'observability', label: 'Observability', group: 'developer', description: 'Receipts, usage and runtime evidence.' },
      { view: 'mission', label: 'Mission Control', group: 'developer', description: 'Supervise a real governed run.' },
      { view: 'runtimes', label: 'Runtimes', group: 'developer', description: 'Inspect installed agent harnesses.' },
      { view: 'integrations', label: 'Integrations', group: 'developer', description: 'Inspect declared APIs and webhooks.' },
      { view: 'skills', label: 'Skills', group: 'developer', description: 'Inspect project instruction skills.' },
      { view: 'marketplace', label: 'Marketplace', group: 'developer', description: 'Inspect signed capability metadata.' },
      { view: 'web', label: 'Web', group: 'developer', description: 'Read public web sources through governed tools.' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    items: [
      { view: 'settings', label: 'Settings', group: 'settings', description: 'Configure FuryPipe without changing the daily chat.' },
      { view: 'support', label: 'About and support', group: 'settings', description: 'Version, documentation and support.' },
    ],
  },
]);

export const STUDIO_DISCOVERABLE_NAVIGATION: readonly StudioNavigationItem[] = Object.freeze(
  STUDIO_NAVIGATION_SECTIONS.flatMap((section) => section.items),
);
