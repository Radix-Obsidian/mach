 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import type { Tables } from "@/integrations/supabase/types";
 
 type Mission = Tables<"missions">;
 
 export function useMission() {
   const [mission, setMission] = useState<Mission | null>(null);
   const [isLoading, setIsLoading] = useState(false);
 
   useEffect(() => {
     if (!mission?.id) return;
 
     const channel = supabase
       .channel(`mission-${mission.id}`)
       .on(
         "postgres_changes",
         {
           event: "UPDATE",
           schema: "public",
           table: "missions",
           filter: `id=eq.${mission.id}`,
         },
         (payload) => {
           setMission(payload.new as Mission);
         }
       )
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [mission?.id]);
 
   const createMission = async (objective: string) => {
     setIsLoading(true);
     try {
       const { data, error } = await supabase
         .from("missions")
         .insert({ objective })
         .select()
         .single();
 
       if (error) throw error;
       setMission(data);
     } catch (error) {
       console.error("Failed to create mission:", error);
     } finally {
       setIsLoading(false);
     }
   };
 
   return { mission, isLoading, createMission };
 }