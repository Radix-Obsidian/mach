/**
 * Consumer view controllers
 * Maps gateway data to consumer-friendly formats for Home, Connections, Routines, Profile
 */

import type { AppViewState } from "../app-view-state";
import type { ActivityItem, SuggestionItem } from "../views/home";
import type { ConnectionStatus } from "../views/connections";
import type { RoutineConfig, RoutineRunInfo } from "../views/routines";
import type { UserPreferences, UserStats } from "../views/profile";
import type { CronJob, CronRunLogEntry, CronSchedule } from "../types";

// =============================================================================
// Home View Data
// =============================================================================

export function deriveRecentActivity(state: AppViewState): ActivityItem[] {
  const activities: ActivityItem[] = [];
  const snapshot = state.channelsSnapshot;

  // Add channel connection events from channelAccounts
  if (snapshot?.channelAccounts) {
    for (const [channelId, accounts] of Object.entries(snapshot.channelAccounts)) {
      for (const account of accounts) {
        if (account.connected && account.lastConnectedAt) {
          const label = snapshot.channelLabels?.[channelId] ?? channelId;
          activities.push({
            id: `channel-${channelId}-${account.accountId}`,
            type: "connection",
            title: `${label} connected`,
            description: `Your ${label} account is active`,
            timestamp: account.lastConnectedAt,
          });
        }
      }
    }
  }

  // Add recent cron runs
  if (state.cronRuns && state.cronRuns.length > 0) {
    for (const run of state.cronRuns.slice(0, 3)) {
      const job = state.cronJobs.find((j) => j.id === run.jobId);
      activities.push({
        id: `cron-${run.jobId}-${run.ts}`,
        type: "routine",
        title: job?.name || run.jobId,
        description: run.status === "ok" ? "Completed successfully" : `Failed: ${run.error || "Unknown error"}`,
        timestamp: run.ts,
      });
    }
  }

  // Sort by timestamp, newest first
  activities.sort((a, b) => b.timestamp - a.timestamp);

  return activities.slice(0, 10);
}

export function deriveSuggestions(state: AppViewState): SuggestionItem[] {
  const suggestions: SuggestionItem[] = [];

  // Suggest connecting a channel if none connected
  const snapshot = state.channelsSnapshot;
  let hasConnectedChannel = false;
  if (snapshot?.channelAccounts) {
    for (const accounts of Object.values(snapshot.channelAccounts)) {
      if (accounts.some((a) => a.connected)) {
        hasConnectedChannel = true;
        break;
      }
    }
  }

  if (!hasConnectedChannel) {
    suggestions.push({
      id: "connect-channel",
      title: "Connect your first social account",
      description: "Connect Instagram, TikTok, or another platform to start receiving smart notifications.",
      action: "connections",
      actionLabel: "Connect Now",
    });
  }

  // Suggest enabling routines if none enabled
  const enabledRoutines = state.cronJobs?.filter((j) => j.enabled) ?? [];
  if (enabledRoutines.length === 0) {
    suggestions.push({
      id: "enable-routines",
      title: "Enable daily recaps",
      description: "Let Dot summarize your day automatically every night.",
      action: "routines",
      actionLabel: "Set Up",
    });
  }

  return suggestions.slice(0, 5);
}

export function deriveRoutineStatus(state: AppViewState): {
  dailyRecapEnabled: boolean;
  weeklyPlanEnabled: boolean;
  followUpsEnabled: boolean;
} {
  const jobs = state.cronJobs ?? [];

  // Look for common routine patterns by name or id
  const dailyRecap = jobs.find(
    (j) => j.enabled && (j.name?.toLowerCase().includes("recap") || j.id?.includes("recap"))
  );
  const weeklyPlan = jobs.find(
    (j) => j.enabled && (j.name?.toLowerCase().includes("weekly") || j.name?.toLowerCase().includes("planning"))
  );
  const followUps = jobs.find(
    (j) => j.enabled && (j.name?.toLowerCase().includes("follow") || j.name?.toLowerCase().includes("reminder"))
  );

  return {
    dailyRecapEnabled: Boolean(dailyRecap),
    weeklyPlanEnabled: Boolean(weeklyPlan),
    followUpsEnabled: Boolean(followUps),
  };
}

// =============================================================================
// Connections View Data
// =============================================================================

const PLATFORM_MAP: Record<string, { name: string; icon: string; features: string[] }> = {
  instagram: { name: "Instagram", icon: "📸", features: ["Comments", "DMs", "Mentions", "Story replies"] },
  tiktok: { name: "TikTok", icon: "🎵", features: ["Comments", "Mentions", "Analytics"] },
  youtube: { name: "YouTube", icon: "▶️", features: ["Comments", "Community posts", "Analytics"] },
  twitter: { name: "X (Twitter)", icon: "🐦", features: ["Mentions", "DMs", "Replies"] },
  discord: { name: "Discord", icon: "💬", features: ["Server messages", "DMs", "Mentions"] },
  whatsapp: { name: "WhatsApp", icon: "💚", features: ["Messages", "Group chats", "Status"] },
  telegram: { name: "Telegram", icon: "✈️", features: ["Messages", "Channels", "Groups"] },
  signal: { name: "Signal", icon: "🔒", features: ["Messages", "Group chats"] },
  imessage: { name: "iMessage", icon: "💬", features: ["Messages", "Group chats"] },
  slack: { name: "Slack", icon: "📢", features: ["Channels", "DMs", "Mentions"] },
  nostr: { name: "Nostr", icon: "🟣", features: ["Notes", "DMs", "Mentions"] },
  googlechat: { name: "Google Chat", icon: "💬", features: ["Messages", "Spaces"] },
};

export function deriveConnections(state: AppViewState): ConnectionStatus[] {
  const connections: ConnectionStatus[] = [];
  const snapshot = state.channelsSnapshot;
  if (!snapshot) return connections;

  // Use channelMeta for the list of channels, channelAccounts for status
  const channelIds = snapshot.channelMeta?.map((m) => m.id) ?? snapshot.channelOrder ?? [];

  for (const channelId of channelIds) {
    const meta = snapshot.channelMeta?.find((m) => m.id === channelId);
    const accounts = snapshot.channelAccounts?.[channelId] ?? [];
    const defaultAccountId = snapshot.channelDefaultAccountId?.[channelId];
    const account = accounts.find((a) => a.accountId === defaultAccountId) ?? accounts[0];

    const platformInfo = PLATFORM_MAP[channelId] ?? {
      name: meta?.label ?? snapshot.channelLabels?.[channelId] ?? channelId,
      icon: "📱",
      features: ["Messages"],
    };

    let status: ConnectionStatus["status"] = "disconnected";
    if (account?.connected) {
      status = "connected";
    } else if (account?.lastError || (account?.configured && !account?.connected)) {
      status = "needs-attention";
    }

    connections.push({
      id: channelId,
      name: platformInfo.name,
      icon: platformInfo.icon,
      status,
      accountName: account?.name ?? undefined,
      lastSync: account?.lastInboundAt ?? account?.lastConnectedAt ?? undefined,
      errorMessage: account?.lastError ?? undefined,
      features: platformInfo.features,
    });
  }

  return connections;
}

// =============================================================================
// Routines View Data
// =============================================================================

export function deriveRoutines(state: AppViewState): RoutineConfig[] {
  return (state.cronJobs ?? []).map((job) => {
    const category = inferRoutineCategory(job);
    const icon = getRoutineIcon(category);

    return {
      id: job.id,
      name: job.name || job.id,
      description: job.description || "Custom automation",
      icon,
      enabled: job.enabled,
      schedule: formatCronSchedule(job.schedule),
      nextRun: job.enabled ? formatNextRun(job.state?.nextRunAtMs) : undefined,
      category,
    };
  });
}

export function deriveRoutineRuns(state: AppViewState): RoutineRunInfo[] {
  return (state.cronRuns ?? []).map((run) => ({
    routineId: run.jobId,
    status: run.status === "ok" ? "success" : "failed",
    timestamp: run.ts,
    summary: run.summary,
  }));
}

function inferRoutineCategory(job: CronJob): RoutineConfig["category"] {
  const name = (job.name || job.id || "").toLowerCase();
  const description = (job.description || "").toLowerCase();

  if (name.includes("recap") || description.includes("recap") || description.includes("summary")) {
    return "recap";
  }
  if (name.includes("weekly") || name.includes("plan") || description.includes("planning")) {
    return "planning";
  }
  if (name.includes("follow") || name.includes("reminder") || description.includes("follow up")) {
    return "followup";
  }
  return "social";
}

function getRoutineIcon(category: RoutineConfig["category"]): string {
  switch (category) {
    case "recap":
      return "🌙";
    case "planning":
      return "📅";
    case "followup":
      return "🔔";
    case "social":
      return "📱";
    default:
      return "⚡";
  }
}

function formatCronSchedule(schedule: CronSchedule | undefined): string {
  if (!schedule) return "Not scheduled";

  switch (schedule.kind) {
    case "at": {
      const date = new Date(schedule.atMs);
      return `Once at ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    case "every": {
      const ms = schedule.everyMs;
      if (ms < 60000) return `Every ${Math.round(ms / 1000)} seconds`;
      if (ms < 3600000) return `Every ${Math.round(ms / 60000)} minutes`;
      if (ms < 86400000) return `Every ${Math.round(ms / 3600000)} hours`;
      return `Every ${Math.round(ms / 86400000)} days`;
    }
    case "cron": {
      // Basic cron parsing for common patterns
      const parts = schedule.expr.split(" ");
      if (parts.length < 5) return schedule.expr;

      const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

      // Daily at specific time
      if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
        return `Daily at ${formatTime(hour, minute)}`;
      }

      // Weekly on specific day
      if (dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const dayNum = parseInt(dayOfWeek, 10);
        const dayName = days[dayNum] || dayOfWeek;
        return `Every ${dayName} at ${formatTime(hour, minute)}`;
      }

      return schedule.expr;
    }
    default:
      return "Scheduled";
  }
}

function formatTime(hour: string, minute: string): string {
  const h = parseInt(hour, 10);
  const m = parseInt(minute, 10);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

function formatNextRun(timestamp: number | undefined): string | undefined {
  if (!timestamp) return undefined;

  const now = Date.now();
  const diff = timestamp - now;

  if (diff < 0) return "Overdue";
  if (diff < 60000) return "In less than a minute";
  if (diff < 3600000) return `In ${Math.floor(diff / 60000)} minutes`;
  if (diff < 86400000) return `In ${Math.floor(diff / 3600000)} hours`;

  const date = new Date(timestamp);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return `Today at ${formatTime(date.getHours().toString(), date.getMinutes().toString())}`;
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow at ${formatTime(date.getHours().toString(), date.getMinutes().toString())}`;
  }

  return date.toLocaleDateString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" });
}

// =============================================================================
// Profile View Data
// =============================================================================

export function deriveUserPreferences(state: AppViewState): UserPreferences {
  const config = state.configForm ?? (state.configSnapshot?.config as Record<string, unknown>) ?? {};
  const memoryConfig = config.memory as Record<string, unknown> | undefined;

  return {
    creatorTone: (config.creatorTone as UserPreferences["creatorTone"]) ?? "friendly",
    customToneDescription: config.customToneDescription as string | undefined,
    autonomyLevel: (config.autonomyLevel as number) ?? 70,
    dailyRecapTime: (config.dailyRecapTime as string) ?? "22:00",
    weeklyPlanDay: (config.weeklyPlanDay as UserPreferences["weeklyPlanDay"]) ?? "sunday",
    weeklyPlanTime: (config.weeklyPlanTime as string) ?? "19:00",
    notificationDigest: (config.notificationDigest as boolean) ?? true,
    saveMemories: (memoryConfig?.enabled as boolean) ?? true,
    shareAnalytics: (config.shareAnalytics as boolean) ?? false,
  };
}

export function deriveUserStats(state: AppViewState): UserStats {
  // Calculate stats from available data
  const recapsSent = (state.cronRuns ?? []).filter(
    (r) => r.status === "ok" && r.jobId?.includes("recap")
  ).length;

  return {
    messagesHandled: state.sessionsResult?.count ?? 0,
    recapsSent,
    followUpsTracked: 0, // Would need additional tracking
    timeSaved: calculateTimeSaved(recapsSent),
    memberSince: "Recently", // Would need user creation date
  };
}

function calculateTimeSaved(recapsSent: number): string {
  // Estimate ~5 minutes saved per recap
  const minutes = recapsSent * 5;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}
