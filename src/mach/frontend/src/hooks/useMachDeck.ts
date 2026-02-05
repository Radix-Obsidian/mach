import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CanvasCard {
  id: string;
  canvas_id: string;
  card_type: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  a2ui_payload: any[];
  metadata?: any;
  created_at: string;
  updated_at: string;
}

interface CanvasInstance {
  id: string;
  owner_id: string;
  team_id?: string;
  canvas_name: string;
  viewport_x: number;
  viewport_y: number;
  viewport_zoom: number;
  created_at: string;
  updated_at: string;
}

export function useMachDeck() {
  const [canvas, setCanvas] = useState<CanvasInstance | null>(null);
  const [cards, setCards] = useState<CanvasCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchDeck = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData?.session) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8080";
      const response = await fetch(`${apiBase}/api/deck`, {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch deck");
      }

      const deckData = await response.json();
      setCanvas(deckData.canvas);
      setCards(deckData.cards || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load deck";
      setError(message);
      console.error("[useMachDeck] Error:", message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount + subscribe to real-time changes
  useEffect(() => {
    fetchDeck();

    // Subscribe to canvas_cards real-time changes
    const channel = supabase
      .channel("canvas_cards_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "canvas_cards",
        },
        (payload) => {
          const newCard = payload.new as CanvasCard;
          setCards((prev) => {
            // Avoid duplicates
            if (prev.some((c) => c.id === newCard.id)) return prev;
            return [...prev, newCard];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "canvas_cards",
        },
        (payload) => {
          setCards((prev) => prev.filter((c) => c.id !== payload.old.id));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "canvas_cards",
        },
        (payload) => {
          const updatedCard = payload.new as CanvasCard;
          setCards((prev) => prev.map((c) => (c.id === updatedCard.id ? updatedCard : c)));
        },
      )
      .subscribe();

    subscriptionRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [fetchDeck]);

  const deleteCard = async (cardId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) throw new Error("Not authenticated");

      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8080";
      const response = await fetch(`${apiBase}/api/deck/cards/${cardId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to delete card");
      setCards((prev) => prev.filter((c) => c.id !== cardId));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete card";
      console.error("[useMachDeck] Delete error:", message);
      setError(message);
    }
  };

  const updateCardPosition = async (cardId: string, x: number, y: number) => {
    // Optimistic update first
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, position_x: x, position_y: y } : c)),
    );

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) throw new Error("Not authenticated");

      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8080";
      const response = await fetch(`${apiBase}/api/deck/cards/${cardId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ position_x: x, position_y: y }),
      });

      if (!response.ok) throw new Error("Failed to update card position");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update position";
      console.error("[useMachDeck] Update error:", message);
      setError(message);
      // Revert on failure
      fetchDeck();
    }
  };

  const addCard = async (cardData: {
    position_x: number;
    position_y: number;
    card_type: string;
    a2ui_payload: any[];
    metadata?: any;
  }) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) throw new Error("Not authenticated");

      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8080";
      const response = await fetch(`${apiBase}/api/deck/cards`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cardData),
      });

      if (!response.ok) throw new Error("Failed to create card");

      const result = await response.json();
      setCards((prev) => [...prev, result.card]);
      return result.card;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create card";
      console.error("[useMachDeck] Add error:", message);
      setError(message);
    }
  };

  return {
    canvas,
    cards,
    loading,
    error,
    deleteCard,
    updateCardPosition,
    addCard,
    refresh: fetchDeck,
  };
}
