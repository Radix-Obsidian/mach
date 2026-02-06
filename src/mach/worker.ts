import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import { resolveAgentWorkspaceDir, resolveAgentDir } from "../agents/agent-scope.js";
import { runEmbeddedPiAgent } from "../agents/pi-embedded.js";
import { ensureAgentWorkspace } from "../agents/workspace.js";
import { loadConfig } from "../config/config.js";
import { resolveSessionFilePath } from "../config/sessions.js";
import { VectorService } from "./services/vector.js";
import { MachTracer, formatCollisionReport } from "./services/tracer.js";

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

// ============================================================================
// MACH AGENT PERSONA
// ============================================================================
const MACH_SYSTEM_PROMPT = `
## MACH Agent — Mission-Driven AI Command Hub

You are MACH, a Flight Director at Mission Control. You are NOT a generic assistant. You are the last gate before a mission launches, and you have zero tolerance for vague objectives, corporate buzzwords, or plans built on vibes instead of physics.

### STEP 1: EVALUATE — Scrub or Clear? (MANDATORY)

Before you write ANYTHING, run the objective through these checks. If it fails ANY ONE of them, the mission is SCRUBBED. Do NOT attempt a flight plan for a scrubbed mission.

**Scrub criteria — any single match = immediate rejection:**
- **No measurable outcome**: "Drive engagement" / "feel modern" / "massive growth" without a number
- **Buzzword payload detected**: "Synergy," "holistic," "leverage paradigms," "delight," "ecosystem" — words that sound good but define nothing
- **Solution without a problem**: Proposes a technology (blockchain, AI, Web3) without defining the friction it removes
- **Vanity vector**: Focused on aesthetics or ego ("bigger logo," "more beautiful") with no user/business outcome
- **Scope hallucination**: "Fundamentally reimagine" / "holistic ecosystem" with no constraints, timeline, or budget

### STEP 2A: SCRUBBED MISSION — Use this format EXACTLY when rejecting

If the objective failed Step 1, your ENTIRE response MUST start with "# STATUS: REJECTED" and follow this template. Do NOT use the Flight Plan template. Do NOT try to salvage the objective into a plan.

# STATUS: REJECTED

> **MISSION SCRUBBED:** [One-line brutal summary using aerospace language]

## REASON
1. [First failure — quote the exact offending phrase from the objective]
2. [Second failure — quote the exact offending phrase]
3. [Third if applicable]

## WHAT'S MISSING
- [Specific thing they must define before resubmission]
- [Another missing element]

## REQUIRED FIX
[Direct orders: what to delete, what to rewrite, what question to answer. End with: "Re-submit with one specific problem, one target metric, and one constraint. Then we fly."]

## CONFIDENCE SCORE
**0%** — Mission cannot launch without actual coordinates.

# AGENT PROMPT
[Your reasoning about why this was scrubbed and what a viable resubmission looks like]

### STEP 2B: CLEARED MISSION — Flight Plan (ONLY if objective passed ALL Step 1 checks)

If and ONLY if the objective passed every check in Step 1, build a flight plan:

# FLIGHT PLAN — CLEAR FOR DEPARTURE

## OBJECTIVE
[One-sentence restatement of the specific problem being solved]

## RISK ASSESSMENT
- [Critical risks that could abort this mission mid-flight]
- [Assumptions that need validation before launch]

## CRITICAL PATH
1. [Step 1 — specific, measurable, time-bounded]
2. [Step 2 — ...]
3. [...]

## UNKNOWNS
- [What data is missing?]
- [What needs recon before proceeding?]

## RESOURCE REQUIREMENTS
- [What's actually needed to execute — people, tools, budget]

## CONFIDENCE SCORE
[0-100% — your honest assessment of mission viability]

# AGENT PROMPT
[Your internal reasoning, trade-offs considered, and alternative vectors evaluated]

### Tone & Style

- **AEROSPACE PRECISION:** You speak like a Flight Director. Use terms like "Abort," "Scrubbed," "Vector," "Payload," "Payload Delta," "Clear for Departure," "Coordinates." Rejected missions are "Scrubbed." Approved missions are "Clear for Departure."
- **CONTEXTUAL WEAPONIZATION:** If documents or codebases are attached, use them as evidence. If their PRD contradicts the repo architecture, call out the specific contradiction. Their own artifacts are your ammunition.
- **ZERO-VOWEL EFFICIENCY:** Aggressively delete corporate adjectives. "Beautiful, seamless experience" → "Beauty is a variable. Seamless is a lie. Re-submit with latency targets and conversion thresholds."
- Be blunt. Respect the reader's intelligence and time.
- Bullet points over paragraphs. Numbers over intuition. Trade-offs always explicit.
- No "Great question!" No "I'd be happy to help!" No filler. Every word earns its payload slot.
`;

type Mission = {
  id: string;
  objective: string;
  status: "pending" | "processing" | "complete" | "failed" | "rejected";
  flight_plan?: string;
  agent_prompt?: string;
  created_at: string;
};

/**
 * Fetch a GitHub repo's key files (README, package.json) via the public API.
 * Returns a summary string or null if fetch fails.
 */
async function fetchGitHubContext(repoUrl: string): Promise<string | null> {
  try {
    // Extract owner/repo from URL (handles https://github.com/owner/repo variants)
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/\s#?]+)/);
    if (!match) return null;

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, "");
    console.log(`[Mach Worker] 🔍 Fetching GitHub context: ${owner}/${cleanRepo}`);

    const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
    }

    const sections: string[] = [];

    // Fetch README
    const readmeRes = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/readme`, { headers });
    if (readmeRes.ok) {
      const readmeData = (await readmeRes.json()) as { content?: string; encoding?: string };
      if (readmeData.content) {
        const readme = Buffer.from(readmeData.content, "base64").toString("utf-8");
        sections.push(`## README.md\n${readme.substring(0, 3000)}`);
      }
    }

    // Fetch package.json (for tech stack detection)
    const pkgRes = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/contents/package.json`, { headers });
    if (pkgRes.ok) {
      const pkgData = (await pkgRes.json()) as { content?: string; encoding?: string };
      if (pkgData.content) {
        const pkg = Buffer.from(pkgData.content, "base64").toString("utf-8");
        sections.push(`## package.json\n${pkg.substring(0, 2000)}`);
      }
    }

    // Fetch repo metadata
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}`, { headers });
    if (repoRes.ok) {
      const repoData = (await repoRes.json()) as {
        description?: string; language?: string; stargazers_count?: number;
        open_issues_count?: number; created_at?: string; updated_at?: string;
      };
      sections.push(`## Repository Metadata\n- Description: ${repoData.description || "None"}\n- Primary Language: ${repoData.language || "Unknown"}\n- Stars: ${repoData.stargazers_count}\n- Open Issues: ${repoData.open_issues_count}\n- Created: ${repoData.created_at}\n- Last Updated: ${repoData.updated_at}`);
    }

    if (sections.length === 0) return null;

    console.log(`[Mach Worker] ✅ GitHub context fetched (${sections.length} sections)`);
    return sections.join("\n\n---\n\n");
  } catch (err) {
    console.error("[Mach Worker] ⚠️ GitHub fetch failed:", err);
    return null;
  }
}

/**
 * Build an enriched prompt from the objective + all attached context.
 */
function buildEnrichedPrompt(
  objective: string,
  repoContext: string | null,
  businessContext?: { revenue_model?: string; monthly_revenue?: number; user_count?: number },
): string {
  const parts: string[] = [`## MISSION OBJECTIVE\n${objective}`];

  if (businessContext) {
    const biz: string[] = [];
    if (businessContext.revenue_model) biz.push(`- Revenue Model: ${businessContext.revenue_model}`);
    if (businessContext.monthly_revenue) biz.push(`- Monthly Revenue (MRR): $${businessContext.monthly_revenue}`);
    if (businessContext.user_count) biz.push(`- Current Users: ${businessContext.user_count}`);
    if (biz.length > 0) {
      parts.push(`## BUSINESS CONTEXT\n${biz.join("\n")}`);
    }
  }

  if (repoContext) {
    parts.push(`## ATTACHED CODEBASE\nThe following is from the GitHub repository the user attached. Use this to evaluate feasibility, identify contradictions, and ground your analysis in the actual system.\n\n${repoContext}`);
  }

  return parts.join("\n\n---\n\n");
}

// ============================================================================
// MACH ENTROPY ALGORITHM (MEA) V1.0
// ============================================================================

interface MEAResult {
  entropyScore: number; // 0-100 composite
  vectors: {
    compressionRatio: number;  // ρ — 0-100 (high = fluff)
    ambiguityDensity: number;  // σ — 0-100 (high = formulaic)
    specificityMass: number;   // μ — 0-100 (high = vague, inverted)
    structuralIntegrity: number; // π — 0-100 (high = unstructured, inverted)
  };
  flightStatus: "approved" | "turbulent" | "rejected";
  flightLabel: "MACH-1" | "LAMINAR" | "TURBULENT" | "PURE CHAOS";
  confidence: number; // 0-1 derived from entropy
}

/**
 * Vector 1: Compression Ratio (ρ) — measures repetition and fluff.
 * Buzzword-heavy text compresses well because it has low unique information.
 */
function calcCompressionRatio(text: string): number {
  if (text.length < 10) return 80; // Too short = no substance
  const raw = Buffer.from(text, "utf-8");
  const compressed = deflateSync(raw);
  const ratio = 1 - (compressed.length / raw.length);
  // ratio ~0.0 = incompressible (unique info), ~0.8+ = highly compressible (fluff)
  // Scale to 0-100 where higher = more entropy (bad)
  return Math.round(Math.max(0, Math.min(100, ratio * 125)));
}

/**
 * Vector 2: Ambiguity Density (σ) — Shannon entropy on character distribution.
 * Low diversity = formulaic template text = higher MEA score.
 */
function calcAmbiguityDensity(text: string): number {
  if (text.length < 5) return 80;
  const freq = new Map<string, number>();
  const lower = text.toLowerCase();
  for (const ch of lower) {
    freq.set(ch, (freq.get(ch) || 0) + 1);
  }
  let shannonH = 0;
  for (const count of freq.values()) {
    const p = count / lower.length;
    if (p > 0) shannonH -= p * Math.log2(p);
  }
  // English text typically has Shannon entropy ~4.0-4.5 bits/char
  // Well-written specs with diverse vocab/symbols: 4.5-5.5
  // Corporate buzzword soup: 3.5-4.0 (repetitive patterns)
  // Normalize: 5.0+ = good (low MEA), <3.5 = bad (high MEA)
  const normalized = Math.max(0, Math.min(100, (5.0 - shannonH) * 50));
  return Math.round(normalized);
}

/**
 * Vector 3: Specificity Mass (μ) — counts "hard entities" that anchor a plan.
 * Numbers, file paths, tech names, constraints, measurable outcomes.
 */
function calcSpecificityMass(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 100;

  let entityCount = 0;

  // Numbers (including percentages, latency targets, monetary values)
  entityCount += (text.match(/\d+(\.\d+)?(%|ms|s|px|rem|em|gb|mb|kb|k\b|\$)/gi) || []).length;
  // Bare numbers that look like metrics/targets
  entityCount += (text.match(/\b\d{2,}\b/g) || []).length;

  // File paths
  entityCount += (text.match(/[\w-]+\.(ts|js|tsx|jsx|py|rs|go|sql|json|yaml|yml|md|css|html)/g) || []).length;
  entityCount += (text.match(/(?:src|lib|api|routes|components|pages|hooks)\//g) || []).length;

  // Technology names (common ones)
  const techTerms = /\b(react|vue|angular|svelte|next|nuxt|express|fastify|postgres|postgresql|mysql|mongodb|redis|docker|kubernetes|k8s|aws|gcp|azure|supabase|firebase|graphql|rest|jwt|oauth|websocket|sse|grpc|typescript|python|rust|golang|node|deno|bun|vite|webpack|tailwind|prisma|drizzle|stripe|twilio|sendgrid|vercel|netlify|cloudflare)\b/gi;
  entityCount += (text.match(techTerms) || []).length;

  // Constraints / acceptance criteria patterns
  entityCount += (text.match(/\b(must|shall|should not|must not|at least|at most|no more than|within \d|maximum|minimum|latency|throughput|uptime)\b/gi) || []).length;

  // Entity density: entities per word
  const density = entityCount / words.length;
  // density > 0.15 = very specific (low MEA)
  // density < 0.02 = no anchors (high MEA)
  // Invert: high specificity = low score
  const score = Math.max(0, Math.min(100, (0.15 - density) * 667));
  return Math.round(score);
}

/**
 * Vector 4: Structural Integrity (π) — checks for plan-like markers.
 * Numbered steps, bullets, headers, conditionals, acceptance criteria.
 */
function calcStructuralIntegrity(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 10) return 70;

  let markers = 0;

  // Numbered steps (1. 2. 3. or 1) 2) 3))
  markers += (text.match(/^\s*\d+[.)]\s/gm) || []).length;
  // Bullet points
  markers += (text.match(/^\s*[-*]\s/gm) || []).length;
  // Section headers (## or ALL CAPS lines)
  markers += (text.match(/^\s*#{1,4}\s/gm) || []).length;
  markers += (text.match(/^[A-Z][A-Z\s]{5,}$/gm) || []).length;
  // Conditional logic
  markers += (text.match(/\b(if|when|unless|otherwise|else|then|given that)\b/gi) || []).length;
  // Timeline/milestone references
  markers += (text.match(/\b(phase|sprint|week|day|milestone|deadline|timeline|by \w+day)\b/gi) || []).length;

  // Expected markers scale with input length (~1 marker per 30 words)
  const expected = Math.max(3, words.length / 30);
  const ratio = markers / expected;
  // ratio > 1.0 = well structured (low MEA)
  // ratio < 0.2 = stream-of-consciousness (high MEA)
  // Invert: high structure = low score
  const score = Math.max(0, Math.min(100, (1.0 - ratio) * 100));
  return Math.round(score);
}

/**
 * MEA Composite: weighted combination of four vectors.
 * MACH-1 TUNING: Ruthless filter — prioritizes Specificity (mu) and Density (rho)
 * to ensure AI agents receive zero-ambiguity payloads.
 */
function calculateEntropy(text: string): MEAResult {
  const rho = calcCompressionRatio(text);
  const sigma = calcAmbiguityDensity(text);
  const mu = calcSpecificityMass(text);
  const pi = calcStructuralIntegrity(text);

  const w1 = 30; // Compression Ratio: Heavily penalize buzzword spam and fluff
  const w2 = 15; // Ambiguity Density: Detect and penalize formulaic templates
  const w3 = 40; // Specificity Mass: HIGHEST — demand concrete numbers, file paths, and tech
  const w4 = 15; // Structural Integrity: Penalize rambling, but don't overvalue bullets

  const entropyScore = Math.round(
    (w1 * rho + w2 * sigma + w3 * mu + w4 * pi) / 100
  );

  // Classify flight status from entropy score
  let flightStatus: MEAResult["flightStatus"];
  let flightLabel: MEAResult["flightLabel"];
  if (entropyScore <= 15) {
    flightStatus = "approved";
    flightLabel = "MACH-1";
  } else if (entropyScore <= 45) {
    flightStatus = "approved";
    flightLabel = "LAMINAR";
  } else if (entropyScore <= 75) {
    flightStatus = "turbulent";
    flightLabel = "TURBULENT";
  } else {
    flightStatus = "rejected";
    flightLabel = "PURE CHAOS";
  }

  // Derive confidence from entropy (inverse relationship)
  const confidence = Math.max(0, Math.min(1, (100 - entropyScore) / 100));

  return {
    entropyScore,
    vectors: {
      compressionRatio: rho,
      ambiguityDensity: sigma,
      specificityMass: mu,
      structuralIntegrity: pi,
    },
    flightStatus,
    flightLabel,
    confidence,
  };
}

/** Detect explicit markers that indicate a vague/needs-input response */
function isVagueResponse(flightPlan: string): boolean {
  const vagueMarkers = [
    "AWAITING MISSION BRIEF",
    "REQUIRED INTEL",
    "MISSION SCRUBBED",
    "cannot proceed without",
    "please provide more",
    "resubmit with",
  ];
  const upper = flightPlan.toUpperCase();
  return vagueMarkers.some((m) => upper.includes(m.toUpperCase()));
}

export async function processMission(id: string, objective: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase client not configured");
  }

  const sessionId = `mach-${id}`;
  const runId = randomUUID();

  console.log(`[Mach Worker] 🚀 Processing mission ${id}`);
  console.log(`[Mach Worker] 📋 Objective: ${objective.substring(0, 100)}...`);

  // Fetch full mission record (owner_id, repository_url, business_context)
  const { data: missionData, error: ownerErr } = await supabase
    .from("missions")
    .select("owner_id, repository_url, business_context")
    .eq("id", id)
    .single();
  if (ownerErr) {
    console.error(`[Mach Worker] ⚠️ Failed to fetch mission ${id}:`, ownerErr);
  }
  const ownerId = missionData?.owner_id;
  const repositoryUrl = missionData?.repository_url as string | undefined;
  const businessContext = missionData?.business_context as { revenue_model?: string; monthly_revenue?: number; user_count?: number } | undefined;
  console.log(`[Mach Worker] 👤 Mission ${id} owner: ${ownerId || "UNKNOWN"}`);
  if (repositoryUrl) console.log(`[Mach Worker] 📦 Repository: ${repositoryUrl}`);
  if (businessContext) console.log(`[Mach Worker] 💰 Business context attached`);

  // === MACH-TRACE: Inverse RAG Validation ===
  if (repositoryUrl && process.env.OPENAI_API_KEY) {
    try {
      const vectorService = new VectorService(supabase);
      const tracer = new MachTracer(vectorService);

      // Ingest repo if not already vectorized
      console.log(`[MachTrace] 📡 Checking vector store for repo context...`);
      await vectorService.ingestGitHubRepo(repositoryUrl);

      // Run trace
      console.log(`[MachTrace] 🔬 Tracing intent against codebase...`);
      const traceResult = await tracer.traceIntent(objective);

      if (traceResult.status === "COLLISION" && traceResult.collisionContext) {
        console.log(`[MachTrace] 💥 COLLISION DETECTED in ${traceResult.collisionContext.source}`);
        const collisionReport = formatCollisionReport(traceResult.collisionContext);

        // Update mission as rejected
        await supabase
          .from("missions")
          .update({ status: "rejected", flight_plan: collisionReport })
          .eq("id", id);

        // Generate deck card with collision metadata
        if (ownerId) {
          const mea = calculateEntropy(objective);
          await generateDeckCards(id, ownerId, collisionReport, undefined, {
            entropyScore: mea.entropyScore,
            confidence: 0,
            flightStatus: "rejected",
            flightLabel: "PURE CHAOS",
            vectors: mea.vectors,
            wordCount: collisionReport.split(/\s+/).length,
          }).catch((err) => console.error("[MachTrace] ⚠️ Collision card failed:", err));
        }

        console.log(`[MachTrace] 🛑 Mission ${id} REJECTED — collision report written`);
        return; // Skip Pi agent entirely
      }

      console.log(`[MachTrace] ✅ Intent clear — proceeding to agent`);
    } catch (traceErr) {
      console.error("[MachTrace] ⚠️ Trace failed, proceeding without validation:", traceErr);
    }
  }

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

    // Fetch GitHub context if a repository URL was attached
    let repoContext: string | null = null;
    if (repositoryUrl) {
      repoContext = await fetchGitHubContext(repositoryUrl);
    }

    // Build enriched prompt with all attached context
    const enrichedPrompt = buildEnrichedPrompt(objective, repoContext, businessContext);
    console.log(`[Mach Worker] 🤖 Running agent: ${provider}/${model} (prompt: ${enrichedPrompt.length} chars)`);

    const result = await runEmbeddedPiAgent({
      sessionId,
      sessionKey: sessionId,
      sessionFile,
      workspaceDir: workspace.dir,
      config: cfg,
      prompt: enrichedPrompt,
      provider,
      model,
      thinkLevel: "medium",
      verboseLevel: "off",
      timeoutMs: 300000,
      runId,
      agentDir,
      extraSystemPrompt: MACH_SYSTEM_PROMPT,
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

    // Run MEA on the user's original objective (NOT the AI response)
    const mea = calculateEntropy(objective);
    console.log(`[Mach Worker] 📊 MEA Score: ${mea.entropyScore} (${mea.flightLabel}) — ρ:${mea.vectors.compressionRatio} σ:${mea.vectors.ambiguityDensity} μ:${mea.vectors.specificityMass} π:${mea.vectors.structuralIntegrity}`);

    // Override to turbulent if the AI response itself signals vague input
    const effectiveStatus = isVagueResponse(flightPlan) ? "turbulent" as const : mea.flightStatus;
    const effectiveLabel = isVagueResponse(flightPlan) ? "TURBULENT" as const : mea.flightLabel;

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

    // Generate Mach Deck cards — skip turbulent missions (noise purge)
    if (effectiveStatus === "turbulent") {
      console.log(`[Mach Worker] 🌀 Mission ${id} classified TURBULENT (entropy: ${mea.entropyScore}) — no deck card created`);
    } else if (ownerId) {
      console.log(`[Mach Deck] 🎴 Generating card for mission ${id}, owner ${ownerId} (${effectiveLabel})`);
      const wordCount = flightPlan.split(/\s+/).filter(Boolean).length;
      await generateDeckCards(id, ownerId, flightPlan, agentPrompt, {
        entropyScore: mea.entropyScore,
        confidence: mea.confidence,
        flightStatus: effectiveStatus,
        flightLabel: effectiveLabel,
        vectors: mea.vectors,
        wordCount,
      }).catch((err) => {
        console.error("[Mach Worker] ⚠️ Deck card generation failed:", err);
      });
    } else {
      console.warn(`[Mach Worker] ⚠️ No owner_id found for mission ${id} - skipping card generation`);
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

interface DeckCardMEA {
  entropyScore: number;
  confidence: number;
  flightStatus: "approved" | "rejected";
  flightLabel: "MACH-1" | "LAMINAR" | "PURE CHAOS";
  vectors: MEAResult["vectors"];
  wordCount: number;
}

async function generateDeckCards(
  missionId: string,
  userId: string,
  flightPlan: string,
  agentPrompt?: string,
  mea?: DeckCardMEA,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    return;
  }

  try {
    console.log(`[Mach Deck] Step 1: Looking for canvas for user ${userId}`);

    // Get user's canvas instance (use limit(1) — user may have duplicate rows)
    const { data: canvasRows, error: canvasError } = await supabase
      .from("canvas_instances")
      .select("id")
      .eq("owner_id", userId)
      .is("team_id", null)
      .order("created_at", { ascending: true })
      .limit(1);

    if (canvasError) {
      console.error("[Mach Deck] Canvas fetch error:", canvasError);
      return;
    }

    let canvasId = canvasRows?.[0]?.id;
    console.log(`[Mach Deck] Step 2: Existing canvas: ${canvasId || "NONE - will create"}`);

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
      console.log(`[Mach Deck] Step 2b: Created canvas ${canvasId}`);
    }

    console.log(`[Mach Deck] Step 3: Building A2UI payload (${flightPlan.length} chars)`);
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

    // Insert card with enriched MEA metadata
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
          confidence_score: mea?.confidence ?? 0.95,
          flight_status: mea?.flightStatus ?? "approved",
          flight_label: mea?.flightLabel ?? "LAMINAR",
          entropy_score: mea?.entropyScore ?? 50,
          vectors: mea?.vectors ?? null,
          created_at_epoch: Date.now(),
          word_count: mea?.wordCount ?? flightPlan.split(/\s+/).length,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Mach Deck] Step 4 FAILED - Card insertion error:", JSON.stringify(insertError));
      return;
    }

    console.log(`[Mach Deck] ✅ Step 4 SUCCESS - Card ${card?.id} created for mission ${missionId}`);
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
