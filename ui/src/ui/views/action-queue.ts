/**
 * Action Review Queue View
 * Review-first approval flow for Dot AI proposed actions
 */

import { html, nothing } from "lit";
import { renderIcon } from "../icons.js";

// =============================================================================
// Types
// =============================================================================

export type ActionRisk = "low" | "medium" | "high";

export type ProposedAction = {
  id: string;
  type: "reply" | "follow_up" | "archive" | "forward" | "schedule";
  platform: string;
  title: string;
  subtitle: string;
  preview: string;
  reason: string;
  risk: ActionRisk;
  createdAt: number;
  metadata?: Record<string, unknown>;
};

export type AutoAllowRule = {
  id: string;
  description: string;
  scope: {
    platform?: string;
    actionType?: string;
    contactType?: "verified" | "vip" | "any";
  };
  constraints: {
    maxAmount?: number;
    keywords?: string[];
    timeWindow?: { start: string; end: string };
  };
  createdAt: number;
  usageCount: number;
};

export type ActionQueueProps = {
  connected: boolean;
  loading: boolean;
  actions: ProposedAction[];
  rules: AutoAllowRule[];
  onApprove: (actionId: string) => void;
  onEdit: (actionId: string) => void;
  onDeny: (actionId: string, reason?: string) => void;
  onCreateRule: (actionId: string) => void;
  onDeleteRule: (ruleId: string) => void;
};

// =============================================================================
// Helpers
// =============================================================================

function getActionIcon(type: ProposedAction["type"]): string {
  switch (type) {
    case "reply":
      return "💬";
    case "follow_up":
      return "🔔";
    case "archive":
      return "📥";
    case "forward":
      return "↗️";
    case "schedule":
      return "📅";
    default:
      return "⚡";
  }
}

function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    tiktok: "🎵",
    youtube: "▶️",
    instagram: "📸",
    twitter: "🐦",
    discord: "💬",
    telegram: "✈️",
    email: "📧",
  };
  return icons[platform.toLowerCase()] || "📱";
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// =============================================================================
// Components
// =============================================================================

function renderActionCard(
  action: ProposedAction,
  props: ActionQueueProps
) {
  const riskClass = `action-card__risk--${action.risk}`;
  const cardClass = action.risk === "high" ? "action-card action-card--high-risk" : "action-card";

  return html`
    <div class="${cardClass}" data-action-id="${action.id}">
      <div class="action-card__header">
        <div class="action-card__icon">${getActionIcon(action.type)}</div>
        <div class="action-card__meta">
          <div class="action-card__title">${action.title}</div>
          <div class="action-card__subtitle">
            <span class="action-card__platform">
              ${getPlatformIcon(action.platform)} ${action.platform}
            </span>
            <span>•</span>
            <span>${formatTimeAgo(action.createdAt)}</span>
          </div>
        </div>
        <div class="action-card__risk ${riskClass}">${action.risk}</div>
      </div>

      <div class="action-card__body">
        <div class="action-card__preview">${action.preview}</div>
        <div class="action-card__reason">
          <span class="action-card__reason-icon">💡</span>
          <span>${action.reason}</span>
        </div>
      </div>

      <div class="action-card__actions">
        <button
          class="action-btn action-btn--primary"
          @click=${() => props.onApprove(action.id)}
        >
          ${renderIcon("check")} Approve
        </button>
        <button
          class="action-btn action-btn--secondary"
          @click=${() => props.onEdit(action.id)}
        >
          ${renderIcon("edit")} Edit
        </button>
        <button
          class="action-btn action-btn--tertiary"
          @click=${() => props.onCreateRule(action.id)}
        >
          Always Allow
        </button>
        <button
          class="action-btn action-btn--danger"
          @click=${() => props.onDeny(action.id)}
        >
          Deny
        </button>
      </div>
    </div>
  `;
}

function renderRuleCard(rule: AutoAllowRule, onDelete: (id: string) => void) {
  return html`
    <div class="rule-card">
      <div class="rule-card__content">
        <div class="rule-card__description">${rule.description}</div>
        <div class="rule-card__meta">
          <span>${formatDate(rule.createdAt)}</span>
          <span class="rule-card__usage">
            <span>•</span>
            <span>Used ${rule.usageCount} times</span>
          </span>
        </div>
      </div>
      <button
        class="rule-card__delete"
        @click=${() => onDelete(rule.id)}
        title="Delete rule"
      >
        ${renderIcon("x")}
      </button>
    </div>
  `;
}

function renderEmptyState() {
  return html`
    <div class="action-queue__empty">
      <div class="action-queue__empty-icon">🎉</div>
      <div class="action-queue__empty-title">All caught up!</div>
      <div class="action-queue__empty-description">
        No actions need your review right now. Dot will notify you when there's something new.
      </div>
    </div>
  `;
}

function renderLoadingState() {
  return html`
    <div class="action-card action-card--loading">
      <div class="action-card__header">
        <div class="action-card__icon">⏳</div>
        <div class="action-card__meta">
          <div class="action-card__title">Loading actions...</div>
          <div class="action-card__subtitle">Please wait</div>
        </div>
      </div>
      <div class="action-card__body">
        <div class="action-card__preview">Loading preview content...</div>
      </div>
    </div>
  `;
}

function renderDisconnectedState() {
  return html`
    <div class="action-queue__empty">
      <div class="action-queue__empty-icon">🔌</div>
      <div class="action-queue__empty-title">Not Connected</div>
      <div class="action-queue__empty-description">
        Connect to your gateway to see pending actions.
      </div>
    </div>
  `;
}

// =============================================================================
// Main Render Function
// =============================================================================

export function renderActionQueue(props: ActionQueueProps) {
  const { connected, loading, actions, rules } = props;

  return html`
    <div class="action-queue">
      <div class="action-queue__header">
        <h2 class="action-queue__title">Action Queue</h2>
        ${actions.length > 0
          ? html`<span class="action-queue__count">${actions.length} pending</span>`
          : nothing}
      </div>

      ${!connected
        ? renderDisconnectedState()
        : loading
          ? renderLoadingState()
          : actions.length === 0
            ? renderEmptyState()
            : html`
                <div class="action-queue__list">
                  ${actions.map((action) => renderActionCard(action, props))}
                </div>
              `}

      ${rules.length > 0
        ? html`
            <div class="action-queue__rules">
              <div class="action-queue__rules-header">
                <h3 class="action-queue__rules-title">Auto-Allow Rules</h3>
              </div>
              <div class="action-queue__rules-list">
                ${rules.map((rule) => renderRuleCard(rule, props.onDeleteRule))}
              </div>
            </div>
          `
        : nothing}
    </div>
  `;
}
