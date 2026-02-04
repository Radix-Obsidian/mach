import { useState, useEffect, useRef } from "react";

interface Mission {
  id: string;
  owner_id?: string;
  objective: string;
  status: string;
  flight_plan: string | null;
  agent_prompt: string | null;
  created_at: string;
}

interface UseMissionReturn {
  mission: Mission | null;
  isLoading: boolean;
  error: string | null;
  createMission: (objective: string) => Promise<void>;
  reset: () => void;
}

// Resolve the backend API base URL (Vite dev proxy or same-origin)
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";

export const useMission = (): UseMissionReturn => {
  const [mission, setMission] = useState<Mission | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll the backend for mission status updates
  useEffect(() => {
    if (!mission || mission.status === "complete" || mission.status === "failed") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/missions/${mission.id}`);
        if (!res.ok) return;
        const updated: Mission = await res.json();
        console.log("Mission polled:", updated.status);
        setMission(updated);
      } catch {
        // Network blip — keep polling
      }
    }, 2000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [mission?.id, mission?.status]);

  const createMission = async (objective: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/missions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server returned ${res.status}`);
      }

      const data: Mission = await res.json();
      console.log("Mission created:", data);
      setMission(data);
    } catch (err) {
      console.error("Error creating mission:", err);
      setError(err instanceof Error ? err.message : "Failed to create mission");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setMission(null);
    setError(null);
    setIsLoading(false);
  };

  return {
    mission,
    isLoading,
    error,
    createMission,
    reset,
  };
};
