import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { resolveAgentWorkspaceDir, resolveAgentDir } from "../agents/agent-scope.js";
import { runEmbeddedPiAgent } from "../agents/pi-embedded.js";
import { ensureAgentWorkspace } from "../agents/workspace.js";
import { loadConfig } from "../config/config.js";
import { resolveSessionFilePath } from "../config/sessions.js";

// Lazy Supabase init — env vars are loaded by server.ts before first request
let _supabase: ReturnType<typeof createClient> | null | undefined;
function getSupabase() {
  if (_supabase === undefined) {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      console.warn("[Mach Worker] ⚠️ Supabase credentials not configured");
      _supabase = null;
    } else {
      _supabase = createClient(url, key);
      console.log("[Mach Worker] ✅ Supabase client initialized");
    }
  }
  return _supabase;
}
const POLL_INTERVAL_MS = Number(process.env.MACH_POLL_INTERVAL_MS) || 5000;

type Mission = {
  id: string;
  objective: string;
  status: "pending" | "processing" | "complete" | "failed";
  flight_plan?: string;
  agent_prompt?: string;
  created_at: string;
};

export async function processMission(id: string, objective: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase client not configured");
  }

  const sessionId = `mach-${id}`;
  const runId = randomUUID();

  console.log(`[Mach Worker] 🚀 Processing mission ${id}`);
  console.log(`[Mach Worker] 📋 Objective: ${objective.substring(0, 100)}...`);

  // Fetch mission owner_id for later deck card generation
  const { data: missionData } = await supabase
    .from("missions")
    .select("owner_id")
    .eq("id", id)
    .single();
  const ownerId = missionData?.owner_id;

  try {
    // Update status to processing
    const { error: procErr } = await supabase
      .from("missions")
      .update({ status: "processing" })
      .eq("id", id);
    if (procErr) console.error("[Mach Worker] ⚠️ Status→processing update failed:", procErr);

    // Load OpenClaw config
    const cfg = loadConfig();
    const agentId = "default";
    const workspaceDirRaw = resolveAgentWorkspaceDir(cfg, agentId);
    const agentDir = resolveAgentDir(cfg, agentId);

    const workspace = await ensureAgentWorkspace({
      dir: workspaceDirRaw,
      ensureBootstrapFiles: !cfg.agents?.defaults?.skipBootstrap,
    });

    const sessionFile = resolveSessionFilePath(sessionId, undefined, { agentId });

    const provider = process.env.MACH_PROVIDER || "anthropic";
    const model = process.env.MACH_MODEL || "claude-sonnet-4-5";

    console.log(`[Mach Worker] 🤖 Running agent: ${provider}/${model}`);

    const result = await runEmbeddedPiAgent({
      sessionId,
      sessionKey: sessionId,
      sessionFile,
      workspaceDir: workspace.dir,
      config: cfg,
      prompt: objective,
      provider,
      model,
      thinkLevel: "medium",
      verboseLevel: "off",
      timeoutMs: 300000,
      runId,
      agentDir,
    });

    const flightPlan = result.payloads
      ?.map((p) => p.text)
      .filter(Boolean)
      .join("\n\n");

    if (!flightPlan || flightPlan.trim() === "") {
      throw new Error("Agent returned empty response");
    }

    console.log(`[Mach Worker] ✅ Response received (${flightPlan.length} chars)`);

    // Extract agent prompt section if present
    const agentPrompt = extractAgentPrompt(flightPlan);

    // Update with result
    const { error: completeErr } = await supabase
      .from("missions")
      .update({
        status: "complete",
        flight_plan: flightPlan,
        agent_prompt: agentPrompt,
        // updated_at column may not exist yet; omit to avoid PGRST204
      })
      .eq("id", id);

    if (completeErr) {
      console.error("[Mach Worker] ⚠️ Status→complete update failed:", completeErr);
    } else {
      console.log(`[Mach Worker] ✅ Mission ${id} complete`);
    }

    // Generate Mach Deck cards for completed missions
    if (ownerId) {
      await generateDeckCards(id, ownerId, flightPlan, agentPrompt).catch((err) => {
        console.error("[Mach Worker] ⚠️ Deck card generation failed:", err);
      });
    }
  } catch (err) {
    console.error(`[Mach Worker] ❌ Mission ${id} failed:`, err);

    const errorMessage = err instanceof Error ? err.message : String(err);

    const { error: failErr } = await supabase
      .from("missions")
      .update({
        status: "failed",
        flight_plan: `# STATUS: FAILED\n\n# ERROR\n${errorMessage}`,
        // updated_at column may not exist yet; omit to avoid PGRST204
      })
      .eq("id", id);
    if (failErr) console.error("[Mach Worker] ⚠️ Status→failed update failed:", failErr);
  }
}

function extractAgentPrompt(flightPlan: string): string | undefined {
  const match = flightPlan.match(/# AGENT PROMPT\s*([\s\S]*?)(?=\n#|$)/i);
  return match ? match[1].trim() : undefined;
}

async function pollAndProcessMissions(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    return;
  }

  try {
    const { data: missions, error } = await supabase
      .from("missions")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) {
      console.error("[Mach Worker] Error fetching missions:", error);
      return;
    }

    if (!missions || missions.length === 0) {
      return;
    }

    const mission = missions[0] as Mission;
    await processMission(mission.id, mission.objective);
  } catch (err) {
    console.error("[Mach Worker] Poll error:", err);
  }
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;

export function startPollingMode(): void {
  if (pollingInterval) {
    return;
  }

  console.log(`[Mach Worker] 🔄 Polling every ${POLL_INTERVAL_MS}ms`);

  pollingInterval = setInterval(async () => {
    await pollAndProcessMissions();
  }, POLL_INTERVAL_MS);

  // Initial poll
  pollAndProcessMissions();
}

export function stopPollingMode(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("[Mach Worker] ⏹️ Polling stopped");
  }
}

// ============================================================================
// MACH DECK CARD GENERATION
// ============================================================================

async function generateDeckCards(
  missionId: string,
  userId: string,
  flightPlan: string,
  agentPrompt?: string,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    return;
  }

  try {
    // Get user's canvas instance
    const { data: canvas, error: canvasError } = await supabase
      .from("canvas_instances")
      .select("id")
      .eq("owner_id", userId)
      .is("team_id", null)
      .single();

    if (canvasError && canvasError.code !== "PGRST116") {
      console.error("[Mach Deck] Canvas fetch error:", canvasError);
      return;
    }

    let canvasId = canvas?.id;

    // Create canvas if doesn't exist
    if (!canvasId) {
      const { data: newCanvas, error: createError } = await supabase
        .from("canvas_instances")
        .insert({ owner_id: userId })
        .select()
        .single();

      if (createError || !newCanvas) {
        console.error("[Mach Deck] Canvas creation failed:", createError);
        return;
      }
      canvasId = newCanvas.id;
    }

    // Generate A2UI payload
    const a2uiPayload = buildFlightPlanCardA2UI(flightPlan, agentPrompt);

    // Calculate position (stagger cards to avoid overlap)
    const { data: existingCards, error: queryError } = await supabase
      .from("canvas_cards")
      .select("position_x")
      .eq("canvas_id", canvasId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (queryError) {
      console.error("[Mach Deck] Position query failed:", queryError);
      return;
    }

    const positionX = existingCards?.[0]?.position_x ? existingCards[0].position_x + 450 : 100;

    // Insert card
    const { data: card, error: insertError } = await supabase
      .from("canvas_cards")
      .insert({
        canvas_id: canvasId,
        card_type: "avionics_card",
        position_x: positionX,
        position_y: 100,
        a2ui_payload: a2uiPayload,
        metadata: {
          mission_id: missionId,
          card_title: "Flight Plan",
          confidence_score: 0.95,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Mach Deck] Card insertion failed:", insertError);
      return;
    }

    console.log(`[Mach Deck] ✅ Card created for mission ${missionId}: ${card?.id}`);
  } catch (err) {
    console.error("[Mach Deck] Unexpected error during card generation:", err);
  }
}

function buildFlightPlanCardA2UI(
  flightPlan: string,
  agentPrompt?: string,
): Array<Record<string, unknown>> {
  const surfaceId = "flight_plan_card";
  const components: Array<Record<string, unknown>> = [
    {
      id: "root",
      component: {
        Card: {
          child: "content_column",
          padding: { all: 16 },
        },
      },
    },
    {
      id: "content_column",
      component: {
        Column: {
          children: { explicitList: ["title", "divider", "flight_plan_text"] },
          spacing: 12,
        },
      },
    },
    {
      id: "title",
      component: {
        Text: {
          text: { literalString: "🚀 Flight Plan" },
          usageHint: "h3",
        },
      },
    },
    {
      id: "divider",
      component: { Divider: {} },
    },
    {
      id: "flight_plan_text",
      component: {
        Text: {
          text: { literalString: flightPlan },
          usageHint: "body",
        },
      },
    },
  ];

  // Add agent prompt section if present
  if (agentPrompt) {
    const columnChildren = (components[1].component as Record<string, Record<string, unknown>>)
      .Column.children as Record<string, unknown[]>;
    columnChildren.explicitList.push("agent_prompt_title", "agent_prompt_text");
    components.push(
      {
        id: "agent_prompt_title",
        component: {
          Text: {
            text: { literalString: "🤖 Agent Prompt" },
            usageHint: "h4",
          },
        },
      },
      {
        id: "agent_prompt_text",
        component: {
          Text: {
            text: { literalString: agentPrompt },
            usageHint: "caption",
          },
        },
      },
    );
  }

  const payloads = [
    { surfaceUpdate: { surfaceId, components } },
    { beginRendering: { surfaceId, root: "root" } },
  ];

  return payloads;
}
