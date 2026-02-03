/**
 * Telemetry Analytics Module
 * Privacy-first event tracking for Dot AI consumer app
 */

// =============================================================================
// Event Types
// =============================================================================

export type TelemetryEvent =
  // Onboarding funnel
  | { event: "onboarding.started" }
  | { event: "onboarding.channel_connected"; platform: string }
  | { event: "onboarding.allowlist_configured"; count: number }
  | { event: "onboarding.memory_enabled" }
  | { event: "onboarding.completed"; duration_ms: number }

  // Inbox events
  | { event: "inbox.viewed" }
  | { event: "inbox.item_received"; platform: string; priority: "high" | "normal" | "low" }
  | { event: "inbox.item_actioned"; action: "reply" | "archive" | "snooze" | "forward" }
  | { event: "inbox.opportunity_detected"; type: "brand_deal" | "collab" | "vip" | "urgent" }
  | { event: "inbox.opportunity_actioned"; outcome: "converted" | "declined" | "ignored" }

  // Routine events
  | { event: "routine.enabled"; routine_id: string }
  | { event: "routine.disabled"; routine_id: string }
  | { event: "routine.completed"; routine_id: string; success: boolean }
  | { event: "routine.skipped"; routine_id: string; reason?: string }
  | { event: "recap.sent" }
  | { event: "recap.opened" }
  | { event: "weekly_plan.generated" }

  // Action Review Queue events
  | { event: "action.proposed"; type: string; risk: "low" | "medium" | "high"; platform: string }
  | { event: "action.approved"; type: string; time_to_approve_ms: number }
  | { event: "action.edited"; type: string; edit_size: "minor" | "major" }
  | { event: "action.denied"; type: string; reason?: string }
  | { event: "action.auto_allowed"; rule_id: string }
  | { event: "rule.created"; scope: string; constraints: string[] }

  // Navigation
  | { event: "tab.viewed"; tab: string }
  | { event: "chat.message_sent" }
  | { event: "chat.suggestion_used" }

  // Connections
  | { event: "connection.started"; platform: string }
  | { event: "connection.completed"; platform: string }
  | { event: "connection.failed"; platform: string; error?: string }
  | { event: "connection.disconnected"; platform: string }

  // Profile
  | { event: "profile.preference_changed"; key: string }
  | { event: "profile.advanced_opened" }

  // North star metrics (computed events)
  | { event: "metric.time_saved_minutes"; value: number }
  | { event: "metric.opportunities_detected"; value: number }
  | { event: "metric.followup_completion_rate"; value: number };

// =============================================================================
// Analytics State
// =============================================================================

type AnalyticsConfig = {
  enabled: boolean;
  debug: boolean;
  endpoint?: string;
  userId?: string;
};

let config: AnalyticsConfig = {
  enabled: true,
  debug: false,
};

let eventQueue: Array<TelemetryEvent & { timestamp: number; userId?: string }> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

// =============================================================================
// Initialization
// =============================================================================

export function initAnalytics(options: Partial<AnalyticsConfig> = {}): void {
  config = { ...config, ...options };

  if (config.debug) {
    console.log("[Analytics] Initialized with config:", config);
  }
}

export function setUserId(userId: string): void {
  config.userId = userId;
}

// =============================================================================
// Track Function
// =============================================================================

export function track<T extends TelemetryEvent>(eventData: T): void {
  if (!config.enabled) return;

  const enrichedEvent = {
    ...eventData,
    timestamp: Date.now(),
    userId: config.userId,
  };

  if (config.debug) {
    console.log("[Analytics] Track:", enrichedEvent);
  }

  eventQueue.push(enrichedEvent);

  // Debounce flush
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 1000);
}

// =============================================================================
// Flush to Backend
// =============================================================================

async function flush(): Promise<void> {
  if (eventQueue.length === 0) return;

  const events = [...eventQueue];
  eventQueue = [];

  if (!config.endpoint) {
    // No endpoint configured, just log in debug mode
    if (config.debug) {
      console.log("[Analytics] Would flush events:", events);
    }
    return;
  }

  try {
    await fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    });
  } catch (err) {
    // Re-queue failed events
    eventQueue = [...events, ...eventQueue];
    if (config.debug) {
      console.error("[Analytics] Flush failed:", err);
    }
  }
}

// =============================================================================
// Convenience Helpers
// =============================================================================

export function trackTabView(tab: string): void {
  track({ event: "tab.viewed", tab });
}

export function trackOnboardingStep(
  step: "started" | "channel_connected" | "allowlist_configured" | "memory_enabled" | "completed",
  meta?: { platform?: string; count?: number; duration_ms?: number }
): void {
  switch (step) {
    case "started":
      track({ event: "onboarding.started" });
      break;
    case "channel_connected":
      track({ event: "onboarding.channel_connected", platform: meta?.platform ?? "unknown" });
      break;
    case "allowlist_configured":
      track({ event: "onboarding.allowlist_configured", count: meta?.count ?? 0 });
      break;
    case "memory_enabled":
      track({ event: "onboarding.memory_enabled" });
      break;
    case "completed":
      track({ event: "onboarding.completed", duration_ms: meta?.duration_ms ?? 0 });
      break;
  }
}

export function trackRoutineToggle(routineId: string, enabled: boolean): void {
  if (enabled) {
    track({ event: "routine.enabled", routine_id: routineId });
  } else {
    track({ event: "routine.disabled", routine_id: routineId });
  }
}

export function trackActionDecision(
  decision: "approved" | "edited" | "denied" | "auto_allowed",
  meta: { type?: string; time_to_approve_ms?: number; edit_size?: "minor" | "major"; reason?: string; rule_id?: string }
): void {
  switch (decision) {
    case "approved":
      track({ event: "action.approved", type: meta.type ?? "unknown", time_to_approve_ms: meta.time_to_approve_ms ?? 0 });
      break;
    case "edited":
      track({ event: "action.edited", type: meta.type ?? "unknown", edit_size: meta.edit_size ?? "minor" });
      break;
    case "denied":
      track({ event: "action.denied", type: meta.type ?? "unknown", reason: meta.reason });
      break;
    case "auto_allowed":
      track({ event: "action.auto_allowed", rule_id: meta.rule_id ?? "unknown" });
      break;
  }
}

export function trackConnection(
  action: "started" | "completed" | "failed" | "disconnected",
  platform: string,
  error?: string
): void {
  switch (action) {
    case "started":
      track({ event: "connection.started", platform });
      break;
    case "completed":
      track({ event: "connection.completed", platform });
      break;
    case "failed":
      track({ event: "connection.failed", platform, error });
      break;
    case "disconnected":
      track({ event: "connection.disconnected", platform });
      break;
  }
}
