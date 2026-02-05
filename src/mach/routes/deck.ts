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
    // Get or create canvas instance
    let { data: canvas, error: canvasError } = await supabase
      .from("canvas_instances")
      .select("*")
      .eq("owner_id", userId)
      .is("team_id", null)
      .single();

    if (canvasError && canvasError.code === "PGRST116") {
      // No canvas exists, create one (upsert to prevent race condition)
      const { data: newCanvas, error: createError } = await supabase
        .from("canvas_instances")
        .upsert({ owner_id: userId }, { onConflict: "owner_id,team_id" })
        .select()
        .single();

      if (createError) {
        console.error("[Mach Deck] Canvas creation failed:", createError);
        return res.status(500).json({ error: "Failed to create canvas" });
      }
      canvas = newCanvas;
    } else if (canvasError) {
      console.error("[Mach Deck] Canvas fetch failed:", canvasError);
      return res.status(500).json({ error: "Failed to fetch canvas" });
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
    // Get user's canvas
    const { data: canvas, error: canvasError } = await supabase
      .from("canvas_instances")
      .select("id")
      .eq("owner_id", userId)
      .is("team_id", null)
      .single();

    if (canvasError || !canvas) {
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
        canvas_id: canvas.id,
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

export { router as deckRouter };
