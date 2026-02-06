import { ChatAnthropic } from "@langchain/anthropic";
import type { VectorService } from "./vector.js";

export interface TraceResult {
  status: "CLEAN" | "COLLISION";
  collisionContext?: {
    source: string;
    snippet: string;
    reason: string;
  };
}

const AUDITOR_SYSTEM_PROMPT = `
You are MACH TRACER. You are the Flight Director responsible for identifying LOGIC COLLISIONS between a Mission Objective and the current System Physics (Codebase + Tribal Knowledge).

Your directive is to ensure that the human payload does not compromise system integrity, duplicate existing telemetry, or drift from established architectural vectors.

A COLLISION is defined as:
1. ARCHITECTURAL DRIFT: Proposing a pattern that contradicts established standards (e.g., using Redux when the codebase is standardized on React Context).
2. REDUNDANT PAYLOAD: Proposing a feature or logic that already exists. We do not ship the same code twice.
3. VECTOR CLASH: The objective overrides or ignores a recorded team decision, deprecation notice, or security constraint.
4. SYSTEM FRACTURE: Proposing a change that breaks hard-coded dependencies or ignores critical constraints found in the retrieved middleware, guards, or types.

EVALUATION PROTOCOL:
- Scrutinize the MISSION OBJECTIVE against the provided context chunks with aerospace precision.
- Use the RETRIEVED CODE to verify the "Hard Physics" of the current system.
- Use the RETRIEVED DOCS/TRIBAL chunks to verify the "Mission History" and decisions.
- If no definitive collision is verified, return CLEAN.
- If a conflict is detected, trigger COLLISION immediately.

OUTPUT SPECIFICATION:
You must return valid JSON only. Do not include fluff, conversational filler, or explanations outside the JSON block.

If status is CLEAN:
{ "status": "CLEAN" }

If status is COLLISION:
{
  "status": "COLLISION",
  "source": "Identified file path or document title",
  "snippet": "The exact quote or code snippet proving the conflict",
  "reason": "A ruthless, aerospace-grade explanation of why this mission is scrubbed."
}
`;

/** 
 * MachTracer — "Inverse RAG" validation layer.
 * Audits mission objectives against vectorized codebase + tribal knowledge
 * BEFORE any planning happens.
 */
export class MachTracer {
  private llm: ChatAnthropic;

  constructor(private vectorService: VectorService) {
    this.llm = new ChatAnthropic({
      model: "claude-sonnet-4-5-20250929",
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      maxTokens: 1024,
      temperature: 0,
    });
  }

  /**
   * Trace a mission objective against the vector store.
   * Returns CLEAN if no conflicts found, COLLISION if contradictions detected.
   */
  async traceIntent(objective: string): Promise<TraceResult> {
    // Graceful degradation: if no data ingested yet, pass through
    const hasData = await this.checkVectorStoreHasData();
    if (!hasData) {
      console.log("[MachTracer] ⏭️ Vector store empty — skipping trace (CLEAN by default)");
      return { status: "CLEAN" };
    }

    // If auditor prompt hasn't been configured yet, pass through
    if (AUDITOR_SYSTEM_PROMPT === "REPLACE_ME") {
      console.log("[MachTracer] ⏭️ Auditor prompt not configured — skipping trace");
      return { status: "CLEAN" };
    }

    try {
      // Step 1: Extract technical entities from the objective
      const entities = await this.extractEntities(objective);
      console.log(`[MachTracer] 🔍 Extracted entities: ${entities.join(", ")}`);

      // Step 2: Parallel vector search — code + docs/tribal
      const searchQuery = `${objective} ${entities.join(" ")}`;
      const [codeResults, docResults] = await Promise.all([
        this.vectorService.search(searchQuery, { type: "code" }, 3),
        this.vectorService.search(searchQuery, { type: "doc" }, 3),
      ]);

      const retrievedContext = [
        ...codeResults.map((d) => `[CODE] ${d.metadata.file_path ?? "unknown"}:\n${d.pageContent}`),
        ...docResults.map((d) => `[DOC] ${d.metadata.file_path ?? "unknown"}:\n${d.pageContent}`),
      ].join("\n\n---\n\n");

      if (!retrievedContext.trim()) {
        console.log("[MachTracer] ⏭️ No relevant context found — CLEAN");
        return { status: "CLEAN" };
      }

      // Step 3: Auditor chain — ask the LLM to evaluate
      console.log(`[MachTracer] 🔬 Running Auditor (${codeResults.length} code, ${docResults.length} doc chunks)`);

      const response = await this.llm.invoke([
        { role: "system", content: AUDITOR_SYSTEM_PROMPT },
        {
          role: "user",
          content: `## MISSION OBJECTIVE\n${objective}\n\n## RETRIEVED SYSTEM CONTEXT\n${retrievedContext}\n\nAnalyze for logic collisions. Respond with JSON only.`,
        },
      ]);

      // Step 4: Parse structured output
      const text = typeof response.content === "string"
        ? response.content
        : response.content.map((c) => ("text" in c ? c.text : "")).join("");

      return this.parseAuditorResponse(text);
    } catch (err) {
      console.error("[MachTracer] ⚠️ Trace failed, defaulting to CLEAN:", err);
      return { status: "CLEAN" };
    }
  }

  /**
   * Lightweight entity extraction via Anthropic.
   * Pulls technical terms, file names, system concepts from the objective.
   */
  private async extractEntities(objective: string): Promise<string[]> {
    try {
      const response = await this.llm.invoke([
        {
          role: "system",
          content:
            "Extract technical entities (function names, file paths, system concepts, tech stack terms, architectural patterns) from the following text. Return ONLY a JSON array of strings. Example: [\"auth\", \"UserGuard\", \"session\", \"checkout\"]",
        },
        { role: "user", content: objective },
      ]);

      const text = typeof response.content === "string"
        ? response.content
        : response.content.map((c) => ("text" in c ? c.text : "")).join("");

      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];
      return JSON.parse(match[0]) as string[];
    } catch {
      console.warn("[MachTracer] ⚠️ Entity extraction failed, using raw objective");
      return objective.split(/\s+/).filter((w) => w.length > 3).slice(0, 10);
    }
  }

  /**
   * Parse the Auditor LLM response into a TraceResult.
   */
  private parseAuditorResponse(text: string): TraceResult {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("[MachTracer] ⚠️ No JSON in auditor response, defaulting to CLEAN");
        return { status: "CLEAN" };
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        status: string;
        source?: string;
        snippet?: string;
        reason?: string;
      };

      if (parsed.status === "COLLISION" && parsed.source && parsed.snippet && parsed.reason) {
        return {
          status: "COLLISION",
          collisionContext: {
            source: parsed.source,
            snippet: parsed.snippet,
            reason: parsed.reason,
          },
        };
      }

      return { status: "CLEAN" };
    } catch {
      console.warn("[MachTracer] ⚠️ Failed to parse auditor response, defaulting to CLEAN");
      return { status: "CLEAN" };
    }
  }

  /**
   * Quick check if the vector store has any data at all.
   */
  private async checkVectorStoreHasData(): Promise<boolean> {
    try {
      const results = await this.vectorService.search("test", undefined, 1);
      return results.length > 0;
    } catch {
      return false;
    }
  }
}

/**
 * Format a collision report for the flight_plan column.
 */
export function formatCollisionReport(collision: NonNullable<TraceResult["collisionContext"]>): string {
  return `# STATUS: REJECTED (MACH-TRACE)
> **FATAL ERROR:** Logic Collision Detected.
> **CONTEXT:** Found conflict in \`${collision.source}\`.
> **EVIDENCE:** "${collision.snippet}"
> **ANALYSIS:** ${collision.reason}
> **REQUIRED FIX:** Re-align objective with system physics.`;
}
