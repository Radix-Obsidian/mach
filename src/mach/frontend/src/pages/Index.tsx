import { motion, AnimatePresence } from "framer-motion";
import MissionInput from "@/components/MissionInput";
import FlightPlanCard from "@/components/FlightPlanCard";
import { useMission } from "@/hooks/useMission";

const Index = () => {
  const { mission, isLoading, createMission, reset } = useMission();

  const handleSubmit = async (objective: string) => {
    await createMission(objective);
  };

  // Show card when mission exists AND status is complete
  const showCard = mission && mission.status === "complete";

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(hsl(var(--primary)) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
      <AnimatePresence mode="wait">
          {!showCard ? (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-8"
            >
              {/* Title */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="text-center"
              >
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
                  <span className="text-glow text-primary">Mission</span>{" "}
                  <span className="text-foreground">Control</span>
                </h1>
                <p className="text-muted-foreground font-mono text-sm">
                  Define your objective. Generate your flight plan.
                </p>
              </motion.div>

              <MissionInput onSubmit={handleSubmit} isLoading={isLoading} />
              
              {/* Pending state indicator */}
              {mission && mission.status === "pending" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 text-muted-foreground font-mono text-sm"
                >
                  <div className="flex gap-1">
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-primary"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
                      />
                    ))}
                  </div>
                  <span>Awaiting flight plan generation...</span>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="card"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-6"
            >
              <FlightPlanCard mission={mission} onReset={reset} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Index;
