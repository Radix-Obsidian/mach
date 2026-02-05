 import { useState } from "react";
 import { useMission } from "@/hooks/useMission";
 import { MissionInput } from "@/components/MissionInput";
 import { FlightPlanCard } from "@/components/FlightPlanCard";
 
 const Index = () => {
   const [objective, setObjective] = useState("");
   const { mission, isLoading, createMission } = useMission();
 
   const handleSubmit = async () => {
     if (!objective.trim()) return;
     await createMission(objective);
     setObjective("");
   };
 
   const showFlightPlan = mission?.status === "complete" && mission?.flight_plan;
 
   return (
     <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
       <div className="w-full max-w-2xl space-y-8">
         <div className="text-center space-y-2">
           <h1 className="text-4xl font-bold text-foreground">Glow Flight Plan</h1>
           <p className="text-muted-foreground">Enter your mission objective to generate a flight plan</p>
         </div>
 
         {!mission && (
           <MissionInput
             value={objective}
             onChange={setObjective}
             onSubmit={handleSubmit}
             isLoading={isLoading}
           />
         )}
 
         {mission && !showFlightPlan && (
           <div className="flex flex-col items-center space-y-4">
             <div className="animate-pulse flex items-center space-x-2">
               <div className="w-3 h-3 bg-primary rounded-full animate-bounce" />
               <span className="text-muted-foreground">Processing mission...</span>
             </div>
             <p className="text-sm text-muted-foreground">Status: {mission.status}</p>
           </div>
         )}
 
         {showFlightPlan && <FlightPlanCard mission={mission} />}
       </div>
     </div>
   );
 };
 
 export default Index;