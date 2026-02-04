import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { loadConfig } from "../config/config.js";
import { runEmbeddedPiAgent } from "../agents/pi-embedded.js";
import { resolveAgentWorkspaceDir, resolveAgentDir } from "../agents/agent-scope.js";
import { ensureAgentWorkspace } from "../agents/workspace.js";
import { resolveSessionFilePath } from "../config/sessions.js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const POLL_INTERVAL_MS = Number(process.env.MACH_POLL_INTERVAL_MS) || 5000;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn("[Mach Worker] ⚠️ Supabase credentials not configured");
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

type Mission = {
  id: string;
  objective: string;
  status: "pending" | "processing" | "complete" | "failed";
  flight_plan?: string;
  agent_prompt?: string;
  created_at: string;
};

export async function processMission(id: string, objective: string): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase client not configured");
  }

  const sessionId = `mach-${id}`;
  const runId = randomUUID();

  console.log(`[Mach Worker] 🚀 Processing mission ${id}`);
  console.log(`[Mach Worker] 📋 Objective: ${objective.substring(0, 100)}...`);

  try {
    // Update status to processing
    const { error: procErr } = await supabase.from("missions").update({ status: "processing" }).eq("id", id);
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
