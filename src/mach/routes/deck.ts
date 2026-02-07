import { createClient } from "@supabase/supabase-js";
import { Router } from "express";
import { authenticateUser, AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

// Lazy Supabase init
let _supabase: ReturnType<typeof createClient> | null | undefined;
function getSupabase() {
  if (_supabase === undefined) {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    _supabase = url && key ? createClient(url, key) : null;
  }
  return _supabase;
}

/**
 * GET /api/deck
 * Fetch user's canvas instance and all cards
 */
router.get("/deck", authenticateUser, async (req: AuthenticatedRequest, res) => {
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const userId = req.user.id;

  try {
    // Get or create canvas instance (use limit(1) — user may have duplicate rows)
    const { data: canvasRows, error: canvasError } = await supabase
      .from("canvas_instances")
      .select("*")
      .eq("owner_id", userId)
      .is("team_id", null)
      .order("created_at", { ascending: true })
      .limit(1);

    if (canvasError) {
      console.error("[Mach Deck] Canvas fetch failed:", canvasError);
      return res.status(500).json({ error: "Failed to fetch canvas" });
    }

    let canvas = canvasRows?.[0] ?? null;

    if (!canvas) {
      // No canvas exists, create one
      const { data: newCanvas, error: createError } = await supabase
        .from("canvas_instances")
        .insert({ owner_id: userId })
        .select()
        .single();

      if (createError) {
        console.error("[Mach Deck] Canvas creation failed:", createError);
        return res.status(500).json({ error: "Failed to create canvas" });
      }
      canvas = newCanvas;
    }

    // Get all cards on this canvas
    const { data: cards, error: cardsError } = await supabase
      .from("canvas_cards")
      .select("*")
      .eq("canvas_id", canvas.id)
      .order("created_at", { ascending: true });

    if (cardsError) {
      console.error("[Mach Deck] Cards fetch failed:", cardsError);
      return res.status(500).json({ error: "Failed to fetch cards" });
    }

    console.log(`[Mach Deck] Fetched ${cards?.length || 0} cards for user ${userId}`);

    res.json({ canvas, cards: cards || [] });
  } catch (err) {
    console.error("[Mach Deck] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/deck/cards
 * Add a new card to the canvas (usually called by agent/worker)
 */
router.post("/deck/cards", authenticateUser, async (req: AuthenticatedRequest, res) => {
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const userId = req.user.id;
  const { position_x, position_y, card_type, a2ui_payload, metadata } = req.body as {
    position_x?: number;
    position_y?: number;
    card_type?: string;
    a2ui_payload?: unknown;
    metadata?: unknown;
  };

  // Validate required fields
  if (position_x === undefined || position_y === undefined || !card_type || !a2ui_payload) {
    return res.status(400).json({
      error: "Missing required fields: position_x, position_y, card_type, a2ui_payload",
    });
  }

  try {
    // Get user's canvas (use limit(1) — user may have duplicate rows)
    const { data: canvasRows, error: canvasError } = await supabase
      .from("canvas_instances")
      .select("id")
      .eq("owner_id", userId)
      .is("team_id", null)
      .order("created_at", { ascending: true })
      .limit(1);

    if (canvasError || !canvasRows?.[0]) {
      // Create canvas if doesn't exist
      const { data: newCanvas, error: createError } = await supabase
        .from("canvas_instances")
        .insert({ owner_id: userId })
        .select()
        .single();

      if (createError || !newCanvas) {
        console.error("[Mach Deck] Canvas creation failed:", createError);
        return res.status(500).json({ error: "Failed to create canvas" });
      }

      // Insert card into new canvas
      const { data: card, error } = await supabase
        .from("canvas_cards")
        .insert({
          canvas_id: newCanvas.id,
          position_x,
          position_y,
          card_type,
          a2ui_payload,
          metadata,
        })
        .select()
        .single();

      if (error) {
        console.error("[Mach Deck] Card creation failed:", error);
        return res.status(500).json({ error: "Failed to create card" });
      }

      console.log(`[Mach Deck] Card created for user ${userId} on new canvas`);
      return res.json({ card });
    }

    // Insert card into existing canvas
    const { data: card, error } = await supabase
      .from("canvas_cards")
      .insert({
        canvas_id: canvasRows[0].id,
        position_x,
        position_y,
        card_type,
        a2ui_payload,
        metadata,
      })
      .select()
      .single();

    if (error) {
      console.error("[Mach Deck] Card creation failed:", error);
      return res.status(500).json({ error: "Failed to create card" });
    }

    console.log(`[Mach Deck] Card created for user ${userId}`);
    res.json({ card });
  } catch (err) {
    console.error("[Mach Deck] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/deck/cards/:id
 * Update card position (drag-and-drop)
 */
router.patch("/deck/cards/:id", authenticateUser, async (req: AuthenticatedRequest, res) => {
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const { id } = req.params;
  const { position_x, position_y } = req.body as {
    position_x?: number;
    position_y?: number;
  };

  if (position_x === undefined || position_y === undefined) {
    return res.status(400).json({ error: "Missing required fields: position_x, position_y" });
  }

  try {
    const { data: card, error } = await supabase
      .from("canvas_cards")
      .update({
        position_x,
        position_y,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Mach Deck] Card update failed:", error);
      return res.status(500).json({ error: "Failed to update card" });
    }

    console.log(`[Mach Deck] Card ${id} position updated`);
    res.json({ card });
  } catch (err) {
    console.error("[Mach Deck] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/deck/cards/:id
 * Delete a card (flick gesture or "Roast the Deck")
 */
router.delete("/deck/cards/:id", authenticateUser, async (req: AuthenticatedRequest, res) => {
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const { id } = req.params;

  try {
    const { error } = await supabase.from("canvas_cards").delete().eq("id", id);

    if (error) {
      console.error("[Mach Deck] Card deletion failed:", error);
      return res.status(500).json({ error: "Failed to delete card" });
    }

    console.log(`[Mach Deck] Card ${id} deleted`);
    res.json({ success: true });
  } catch (err) {
    console.error("[Mach Deck] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/deck/cards/stale
 * Bulk-delete cards matching staleness criteria (Roast the Deck)
 */
router.delete("/deck/cards/stale", authenticateUser, async (req: AuthenticatedRequest, res) => {
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: "Supabase not configured" });
  }

  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const userId = req.user.id;

  const {
    max_entropy = 75,
    max_age_days = 30,
    min_confidence = 0.3,
  } = req.body as {
    max_entropy?: number;
    max_age_days?: number;
    min_confidence?: number;
  };

  try {
    // Get user's canvas
    const { data: canvasRows, error: canvasError } = await supabase
      .from("canvas_instances")
      .select("id")
      .eq("owner_id", userId)
      .is("team_id", null)
      .order("created_at", { ascending: true })
      .limit(1);

    if (canvasError || !canvasRows?.[0]) {
      return res.json({ deleted_count: 0, cards_deleted: [] });
    }

    const canvasId = canvasRows[0].id;

    // Fetch all cards for this canvas
    const { data: allCards, error: fetchError } = await supabase
      .from("canvas_cards")
      .select("id, metadata, created_at")
      .eq("canvas_id", canvasId);

    if (fetchError || !allCards) {
      return res.status(500).json({ error: "Failed to fetch cards" });
    }

    // Filter cards that match ANY staleness criterion
    const now = Date.now();
    const staleIds: string[] = [];

    for (const card of allCards) {
      const meta = card.metadata as Record<string, unknown> | null;
      if (!meta) continue;

      const entropy = (meta.entropy_score as number) ?? 0;
      const confidence = (meta.confidence_score as number) ?? 1;
      const createdEpoch = (meta.created_at_epoch as number) ?? now;
      const ageDays = (now - createdEpoch) / 86400000;

      if (entropy > max_entropy || confidence < min_confidence || ageDays > max_age_days) {
        staleIds.push(card.id);
      }
    }

    if (staleIds.length === 0) {
      return res.json({ deleted_count: 0, cards_deleted: [] });
    }

    // Bulk delete
    const { error: deleteError } = await supabase
      .from("canvas_cards")
      .delete()
      .in("id", staleIds);

    if (deleteError) {
      console.error("[Mach Deck] Roast deletion failed:", deleteError);
      return res.status(500).json({ error: "Failed to delete stale cards" });
    }

    console.log(`[Mach Deck] Roasted ${staleIds.length} stale cards for user ${userId}`);
    res.json({ deleted_count: staleIds.length, cards_deleted: staleIds });
  } catch (err) {
    console.error("[Mach Deck] Roast error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export { router as deckRouter };
