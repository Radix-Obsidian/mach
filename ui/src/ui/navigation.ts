import type { IconName } from "./icons.js";

// ============================================================================
// Creator-first navigation for Dot AI SaaS/PWA
// Primary tabs: Home, Inbox, Routines, Chat, Connections, Profile
// Advanced (hidden): legacy engineering views for power users
// ============================================================================

export const TAB_GROUPS = [
  { label: null, tabs: ["home", "inbox", "actions", "routines", "chat", "connections", "profile"] },
  {
    label: "Advanced",
    tabs: ["overview", "channels", "instances", "sessions", "cron", "memory", "skills", "nodes", "config", "debug", "logs"],
  },
] as const;

// Primary consumer tabs
export type PrimaryTab = "home" | "inbox" | "actions" | "routines" | "chat" | "connections" | "profile";

// Legacy/advanced tabs (hidden under Profile → Advanced)
export type AdvancedTab =
  | "overview"
  | "channels"
  | "instances"
  | "sessions"
  | "cron"
  | "memory"
  | "skills"
  | "nodes"
  | "config"
  | "debug"
  | "logs";

export type Tab = PrimaryTab | AdvancedTab;

// Primary tabs shown in main navigation
export const PRIMARY_TABS: PrimaryTab[] = ["home", "inbox", "actions", "routines", "chat", "connections", "profile"];

// Advanced tabs hidden behind Profile → Advanced
export const ADVANCED_TABS: AdvancedTab[] = [
  "overview", "channels", "instances", "sessions", "cron",
  "memory", "skills", "nodes", "config", "debug", "logs"
];

export function isPrimaryTab(tab: Tab): tab is PrimaryTab {
  return PRIMARY_TABS.includes(tab as PrimaryTab);
}

export function isAdvancedTab(tab: Tab): tab is AdvancedTab {
  return ADVANCED_TABS.includes(tab as AdvancedTab);
}

const TAB_PATHS: Record<Tab, string> = {
  // Primary tabs
  home: "/",
  inbox: "/inbox",
  actions: "/actions",
  routines: "/routines",
  chat: "/chat",
  connections: "/connections",
  profile: "/profile",
  // Advanced tabs
  overview: "/advanced/overview",
  channels: "/advanced/channels",
  instances: "/advanced/instances",
  sessions: "/advanced/sessions",
  cron: "/advanced/cron",
  memory: "/advanced/memory",
  skills: "/advanced/skills",
  nodes: "/advanced/nodes",
  config: "/advanced/config",
  debug: "/advanced/debug",
  logs: "/advanced/logs",
};

const PATH_TO_TAB = new Map(Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as Tab]));

export function normalizeBasePath(basePath: string): string {
  if (!basePath) return "";
  let base = basePath.trim();
  if (!base.startsWith("/")) base = `/${base}`;
  if (base === "/") return "";
  if (base.endsWith("/")) base = base.slice(0, -1);
  return base;
}

export function normalizePath(path: string): string {
  if (!path) return "/";
  let normalized = path.trim();
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function pathForTab(tab: Tab, basePath = ""): string {
  const base = normalizeBasePath(basePath);
  const path = TAB_PATHS[tab];
  return base ? `${base}${path}` : path;
}

export function tabFromPath(pathname: string, basePath = ""): Tab | null {
  const base = normalizeBasePath(basePath);
  let path = pathname || "/";
  if (base) {
    if (path === base) {
      path = "/";
    } else if (path.startsWith(`${base}/`)) {
      path = path.slice(base.length);
    }
  }
  let normalized = normalizePath(path).toLowerCase();
  if (normalized.endsWith("/index.html")) normalized = "/";
  if (normalized === "/") return "home";
  return PATH_TO_TAB.get(normalized) ?? null;
}

export function inferBasePathFromPathname(pathname: string): string {
  let normalized = normalizePath(pathname);
  if (normalized.endsWith("/index.html")) {
    normalized = normalizePath(normalized.slice(0, -"/index.html".length));
  }
  if (normalized === "/") return "";
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) return "";
  for (let i = 0; i < segments.length; i++) {
    const candidate = `/${segments.slice(i).join("/")}`.toLowerCase();
    if (PATH_TO_TAB.has(candidate)) {
      const prefix = segments.slice(0, i);
      return prefix.length ? `/${prefix.join("/")}` : "";
    }
  }
  return `/${segments.join("/")}`;
}

export function iconForTab(tab: Tab): IconName {
  switch (tab) {
    // Primary consumer tabs
    case "home":
      return "home";
    case "inbox":
      return "inbox";
    case "actions":
      return "check";
    case "routines":
      return "zap";
    case "chat":
      return "messageSquare";
    case "connections":
      return "link";
    case "profile":
      return "user";
    // Advanced tabs
    case "overview":
      return "barChart";
    case "channels":
      return "radio";
    case "instances":
      return "monitor";
    case "sessions":
      return "fileText";
    case "cron":
      return "loader";
    case "memory":
      return "brain";
    case "skills":
      return "sparkles";
    case "nodes":
      return "server";
    case "config":
      return "settings";
    case "debug":
      return "bug";
    case "logs":
      return "scrollText";
    default:
      return "folder";
  }
}

export function titleForTab(tab: Tab) {
  switch (tab) {
    // Primary consumer tabs
    case "home":
      return "Home";
    case "inbox":
      return "Inbox";
    case "actions":
      return "Actions";
    case "routines":
      return "Routines";
    case "chat":
      return "Chat";
    case "connections":
      return "Connections";
    case "profile":
      return "Profile";
    // Advanced tabs
    case "overview":
      return "Overview";
    case "channels":
      return "Channels";
    case "instances":
      return "Instances";
    case "sessions":
      return "Sessions";
    case "cron":
      return "Cron Jobs";
    case "memory":
      return "Memory";
    case "skills":
      return "Skills";
    case "nodes":
      return "Nodes";
    case "config":
      return "Config";
    case "debug":
      return "Debug";
    case "logs":
      return "Logs";
    default:
      return "Dot";
  }
}

export function subtitleForTab(tab: Tab) {
  switch (tab) {
    // Primary consumer tabs
    case "home":
      return "Your daily overview, recaps, and suggestions from Dot.";
    case "inbox":
      return "Social notifications and reply recommendations.";
    case "actions":
      return "Review and approve Dot's proposed actions.";
    case "routines":
      return "Automations that run while you sleep.";
    case "chat":
      return "Ask Dot anything or draft content.";
    case "connections":
      return "Connect your social accounts.";
    case "profile":
      return "Your preferences and settings.";
    // Advanced tabs
    case "overview":
      return "Gateway status and diagnostics.";
    case "channels":
      return "Channel configuration and health.";
    case "instances":
      return "Connected clients and nodes.";
    case "sessions":
      return "Active conversation sessions.";
    case "cron":
      return "Scheduled automation jobs.";
    case "memory":
      return "Memory storage and search.";
    case "skills":
      return "Available skills and integrations.";
    case "nodes":
      return "Paired devices and capabilities.";
    case "config":
      return "Advanced configuration.";
    case "debug":
      return "Diagnostics and debugging tools.";
    case "logs":
      return "System logs and events.";
    default:
      return "";
  }
}
