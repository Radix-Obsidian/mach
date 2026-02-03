/**
 * Action Queue Controller
 * State management for the Action Review Queue
 */

import type { AppViewState } from "../app-view-state";
import type { ProposedAction, AutoAllowRule } from "../views/action-queue";
import { track, trackActionDecision } from "../analytics";

// =============================================================================
// State Extension
// =============================================================================

export type ActionQueueState = {
  actionQueueLoading: boolean;
  actionQueueError: string | null;
  proposedActions: ProposedAction[];
  autoAllowRules: AutoAllowRule[];
  actionQueueBusy: boolean;
};

export const initialActionQueueState: ActionQueueState = {
  actionQueueLoading: false,
  actionQueueError: null,
  proposedActions: [],
  autoAllowRules: [],
  actionQueueBusy: false,
};

// =============================================================================
// Actions
// =============================================================================

export async function loadActionQueue(
  state: AppViewState & Partial<ActionQueueState>,
  update: (patch: Partial<ActionQueueState>) => void
): Promise<void> {
  if (!state.client || !state.connected) return;

  update({ actionQueueLoading: true, actionQueueError: null });

  try {
    // TODO: Wire to gateway RPC call when available
    // const result = await state.client.call("action-queue.list", {});
    
    // For now, return empty - will be wired when gateway supports it
    update({
      actionQueueLoading: false,
      proposedActions: [],
      autoAllowRules: [],
    });
  } catch (err) {
    update({
      actionQueueLoading: false,
      actionQueueError: err instanceof Error ? err.message : "Failed to load action queue",
    });
  }
}

export async function approveAction(
  state: AppViewState & Partial<ActionQueueState>,
  update: (patch: Partial<ActionQueueState>) => void,
  actionId: string
): Promise<void> {
  if (!state.client || !state.connected) return;

  const action = state.proposedActions?.find((a) => a.id === actionId);
  if (!action) return;

  const startTime = Date.now();
  update({ actionQueueBusy: true });

  try {
    // TODO: Wire to gateway RPC call when available
    // await state.client.call("action-queue.approve", { actionId });

    // Track approval
    trackActionDecision("approved", {
      type: action.type,
      time_to_approve_ms: Date.now() - startTime,
    });

    // Remove from local state
    update({
      actionQueueBusy: false,
      proposedActions: (state.proposedActions ?? []).filter((a) => a.id !== actionId),
    });
  } catch (err) {
    update({
      actionQueueBusy: false,
      actionQueueError: err instanceof Error ? err.message : "Failed to approve action",
    });
  }
}

export async function denyAction(
  state: AppViewState & Partial<ActionQueueState>,
  update: (patch: Partial<ActionQueueState>) => void,
  actionId: string,
  reason?: string
): Promise<void> {
  if (!state.client || !state.connected) return;

  const action = state.proposedActions?.find((a) => a.id === actionId);
  if (!action) return;

  update({ actionQueueBusy: true });

  try {
    // TODO: Wire to gateway RPC call when available
    // await state.client.call("action-queue.deny", { actionId, reason });

    // Track denial
    trackActionDecision("denied", {
      type: action.type,
      reason,
    });

    // Remove from local state
    update({
      actionQueueBusy: false,
      proposedActions: (state.proposedActions ?? []).filter((a) => a.id !== actionId),
    });
  } catch (err) {
    update({
      actionQueueBusy: false,
      actionQueueError: err instanceof Error ? err.message : "Failed to deny action",
    });
  }
}

export async function createAutoAllowRule(
  state: AppViewState & Partial<ActionQueueState>,
  update: (patch: Partial<ActionQueueState>) => void,
  actionId: string
): Promise<void> {
  if (!state.client || !state.connected) return;

  const action = state.proposedActions?.find((a) => a.id === actionId);
  if (!action) return;

  update({ actionQueueBusy: true });

  try {
    // Create rule based on action properties
    const newRule: AutoAllowRule = {
      id: `rule-${Date.now()}`,
      description: `Always allow ${action.type} actions on ${action.platform}`,
      scope: {
        platform: action.platform,
        actionType: action.type,
      },
      constraints: {},
      createdAt: Date.now(),
      usageCount: 0,
    };

    // TODO: Wire to gateway RPC call when available
    // await state.client.call("action-queue.create-rule", { rule: newRule });

    // Track rule creation
    track({
      event: "rule.created",
      scope: `${action.platform}:${action.type}`,
      constraints: [],
    });

    // Approve the action and add rule
    trackActionDecision("approved", {
      type: action.type,
      time_to_approve_ms: 0,
    });

    update({
      actionQueueBusy: false,
      proposedActions: (state.proposedActions ?? []).filter((a) => a.id !== actionId),
      autoAllowRules: [...(state.autoAllowRules ?? []), newRule],
    });
  } catch (err) {
    update({
      actionQueueBusy: false,
      actionQueueError: err instanceof Error ? err.message : "Failed to create rule",
    });
  }
}

export async function deleteAutoAllowRule(
  state: AppViewState & Partial<ActionQueueState>,
  update: (patch: Partial<ActionQueueState>) => void,
  ruleId: string
): Promise<void> {
  if (!state.client || !state.connected) return;

  update({ actionQueueBusy: true });

  try {
    // TODO: Wire to gateway RPC call when available
    // await state.client.call("action-queue.delete-rule", { ruleId });

    update({
      actionQueueBusy: false,
      autoAllowRules: (state.autoAllowRules ?? []).filter((r) => r.id !== ruleId),
    });
  } catch (err) {
    update({
      actionQueueBusy: false,
      actionQueueError: err instanceof Error ? err.message : "Failed to delete rule",
    });
  }
}

export function editAction(
  state: AppViewState & Partial<ActionQueueState>,
  actionId: string
): void {
  const action = state.proposedActions?.find((a) => a.id === actionId);
  if (!action) return;

  // Navigate to chat with the action context for editing
  // The user can modify the preview in chat and then approve
  state.setTab("chat");

  // Set chat message to the preview for editing
  if (state.setChatMessage) {
    state.setChatMessage(`Edit this response:\n\n${action.preview}`);
  }
}
