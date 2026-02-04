import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Mission {
  id: string;
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

export const useMission = (): UseMissionReturn => {
  const [mission, setMission] = useState<Mission | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);

  // Subscribe to realtime updates when we have a mission ID
  useEffect(() => {
    if (!missionId) return;

    const channel = supabase
      .channel(`mission-${missionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'missions',
          filter: `id=eq.${missionId}`,
        },
        (payload) => {
          console.log('Mission updated:', payload);
          setMission(payload.new as Mission);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [missionId]);

  const createMission = async (objective: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from('missions')
        .insert({ objective })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log('Mission created:', data);
      setMission(data);
      setMissionId(data.id);
    } catch (err) {
      console.error('Error creating mission:', err);
      setError(err instanceof Error ? err.message : 'Failed to create mission');
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setMission(null);
    setMissionId(null);
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
