 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import type { Tables } from "@/integrations/supabase/types";
 
 interface FlightPlanCardProps {
   mission: Tables<"missions">;
 }
 
 export function FlightPlanCard({ mission }: FlightPlanCardProps) {
   return (
     <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
       <CardHeader>
         <CardTitle className="text-xl">Flight Plan</CardTitle>
         <p className="text-sm text-muted-foreground">Objective: {mission.objective}</p>
       </CardHeader>
       <CardContent className="space-y-4">
         <div className="prose prose-sm max-w-none">
           <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg text-sm">
             {mission.flight_plan}
           </pre>
         </div>
         {mission.agent_prompt && (
           <details className="text-sm">
             <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
               View Agent Prompt
             </summary>
             <pre className="mt-2 whitespace-pre-wrap bg-muted/50 p-3 rounded text-xs">
               {mission.agent_prompt}
             </pre>
           </details>
         )}
       </CardContent>
     </Card>
   );
 }