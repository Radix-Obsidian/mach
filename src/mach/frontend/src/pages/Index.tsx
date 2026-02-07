import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Menu, Zap } from "lucide-react";
import { useState } from "react";
import FlightPlanCard from "@/components/FlightPlanCard";
import MissionInput from "@/components/MissionInput";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useMission } from "@/hooks/useMission";
import { useSession } from "@/hooks/useSession";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { mission, isLoading, createMission, reset } = useMission();
  const { session } = useSession();
  const { subscription, canCreateMission, remainingMissions } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSubmit = async (
    objective: string,
    options?: {
      repoUrl?: string;
      files?: File[];
      businessContext?: { revenue_model?: string; monthly_revenue?: number; user_count?: number };
    },
  ) => {
    // Check quota before creating mission
    if (!canCreateMission()) {
      setShowUpgradeModal(true);
      return;
    }

    await createMission(objective, options);
  };

  // Show card when mission exists AND status is a terminal state
  const showCard =
    mission &&
    (mission.status === "complete" || mission.status === "failed" || mission.status === "rejected");

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Header with user menu */}
      <header className="fixed top-0 right-0 z-50 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-2 py-1.5 text-sm text-muted-foreground">{session?.user?.email}</div>
            <a
              href="/app/deck"
              className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-slate-900 rounded cursor-pointer transition-colors"
            >
              <Zap className="w-4 h-4" />
              Mach Deck
            </a>
            <a
              href="/app/settings"
              className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-slate-900 rounded cursor-pointer transition-colors"
            >
              Settings
            </a>
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

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
            backgroundSize: "60px 60px",
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

              {/* Quota indicator */}
              {subscription && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center font-mono text-xs text-muted-foreground"
                >
                  <p>Missions: {remainingMissions()} remaining this month</p>
                  <div className="w-48 h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                      style={{
                        width: `${Math.min(100, (subscription.missions_used / subscription.missions_quota) * 100)}%`,
                      }}
                    />
                  </div>
                </motion.div>
              )}

              {/* Pending / processing state indicator */}
              {mission && (mission.status === "pending" || mission.status === "processing") && (
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

        {/* Upgrade Modal */}
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          currentTier={subscription?.plan_tier || "free"}
          missionsUsed={subscription?.missions_used || 0}
          missionsQuota={subscription?.missions_quota || 3}
        />
      </div>
    </div>
  );
};

export default Index;
