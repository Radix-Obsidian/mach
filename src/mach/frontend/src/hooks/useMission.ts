import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Mission {
  id: string;
  owner_id?: string;
  objective: string;
  status: string;
  flight_plan: string | null;
  agent_prompt: string | null;
  created_at: string;
  repository_url?: string;
  spec_documents?: Array<{ name: string; url: string; type: string; size: number }>;
  audit_report?: {
    findings: string[];
    recommendations: string[];
    risk_score: number;
  };
  business_context?: {
    revenue_model?: string;
    monthly_revenue?: number;
    user_count?: number;
  };
}

interface CreateMissionOptions {
  repoUrl?: string;
  files?: File[];
  businessContext?: {
    revenue_model?: string;
    monthly_revenue?: number;
    user_count?: number;
  };
}

interface UseMissionReturn {
  mission: Mission | null;
  isLoading: boolean;
  error: string | null;
  createMission: (objective: string, options?: CreateMissionOptions) => Promise<void>;
  reset: () => void;
}

// Resolve the backend API base URL (Vite dev proxy or same-origin)
const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";

export const useMission = (): UseMissionReturn => {
  const [mission, setMission] = useState<Mission | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failCountRef = useRef(0);
  const maxPollFailures = 30; // Stop after ~2 minutes of failures

  // Poll the backend for mission status updates
  useEffect(() => {
    if (
      !mission ||
      mission.status === "complete" ||
      mission.status === "failed" ||
      mission.status === "rejected"
    ) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      failCountRef.current = 0;
      return;
    }

    // Backoff: start at 2s, increase on failures (max 10s)
    const getInterval = () => Math.min(2000 + failCountRef.current * 1000, 10000);

    const poll = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const headers: Record<string, string> = {};
        if (sessionData?.session?.access_token) {
          headers["Authorization"] = `Bearer ${sessionData.session.access_token}`;
        }

        const res = await fetch(`${API_BASE}/api/missions/${mission.id}`, { headers });
        if (!res.ok) {
          failCountRef.current++;
          if (failCountRef.current >= maxPollFailures) {
            console.warn("[useMission] Polling stopped after too many failures");
            if (pollRef.current) clearInterval(pollRef.current);
          }
          return;
        }
        failCountRef.current = 0;
        const updated: Mission = await res.json();
        setMission(updated);
      } catch {
        failCountRef.current++;
        if (failCountRef.current >= maxPollFailures) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }
    };

    pollRef.current = setInterval(poll, getInterval());

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [mission?.id, mission?.status]);

  const createMission = async (objective: string, options?: CreateMissionOptions) => {
    setIsLoading(true);
    setError(null);

    try {
      // Get JWT token from Supabase session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("No authentication token found");
      }

      // 1. Create mission with objective + optional audit fields
      const payload: Record<string, unknown> = { objective };
      if (options?.repoUrl) payload.repository_url = options.repoUrl;
      if (options?.businessContext) payload.business_context = options.businessContext;

      const res = await fetch(`${API_BASE}/api/missions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server returned ${res.status}`);
      }

      const data: Mission = await res.json();
      console.log("Mission created:", data);
      setMission(data);

      // 2. Upload files if provided (fire-and-forget, mission already created)
      if (options?.files && options.files.length > 0) {
        for (const file of options.files) {
          const base64 = await fileToBase64(file);
          await fetch(`${API_BASE}/api/missions/${data.id}/documents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              fileData: base64,
              fileType: file.type,
            }),
          });
        }
      }
    } catch (err) {
      console.error("Error creating mission:", err);
      setError(err instanceof Error ? err.message : "Failed to create mission");
    } finally {
      setIsLoading(false);
    }
  };

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data URL prefix (e.g. "data:application/pdf;base64,")
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

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
