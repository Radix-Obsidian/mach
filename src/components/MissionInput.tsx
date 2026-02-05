 import { Input } from "@/components/ui/input";
 import { Loader2 } from "lucide-react";
 
 interface MissionInputProps {
   value: string;
   onChange: (value: string) => void;
   onSubmit: () => void;
   isLoading: boolean;
 }
 
 export function MissionInput({ value, onChange, onSubmit, isLoading }: MissionInputProps) {
   const handleKeyDown = (e: React.KeyboardEvent) => {
     if (e.key === "Enter" && !isLoading) {
       onSubmit();
     }
   };
 
   return (
     <div className="relative">
       <Input
         placeholder="Enter your mission objective..."
         value={value}
         onChange={(e) => onChange(e.target.value)}
         onKeyDown={handleKeyDown}
         disabled={isLoading}
         className="h-14 text-lg px-6 pr-12"
       />
       {isLoading && (
         <div className="absolute right-4 top-1/2 -translate-y-1/2">
           <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
         </div>
       )}
     </div>
   );
 }