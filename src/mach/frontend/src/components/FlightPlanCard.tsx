import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Target, Cpu, Terminal, RotateCcw, Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Mission {
  id: string;
  objective: string;
  status: string;
  flight_plan: string | null;
  agent_prompt: string | null;
}

interface FlightPlanCardProps {
  mission: Mission;
  onReset?: () => void;
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  content: string;
  delay: number;
  accentClass?: string;
  copyHoverClass?: string;
}

// Decrypt/scramble effect characters
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";

const Section = ({ title, icon, content, delay, accentClass = "text-primary", copyHoverClass = "hover:text-primary hover:bg-primary/10" }: SectionProps) => {
  const [displayedContent, setDisplayedContent] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let intervalId: ReturnType<typeof setInterval>;
    let charIndex = 0;
    let scrambleCount = 0;
    const maxScrambles = 3;
    
    timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        if (charIndex <= content.length) {
          // Create scrambled suffix for "decryption" effect
          const revealedPart = content.slice(0, charIndex);
          const remainingLength = Math.min(8, content.length - charIndex);
          
          if (scrambleCount < maxScrambles && charIndex < content.length) {
            const scrambledSuffix = Array.from({ length: remainingLength }, () => 
              CHARS[Math.floor(Math.random() * CHARS.length)]
            ).join('');
            setDisplayedContent(revealedPart + scrambledSuffix);
            scrambleCount++;
          } else {
            setDisplayedContent(revealedPart);
            charIndex++;
            scrambleCount = 0;
          }
        } else {
          clearInterval(intervalId);
          setIsComplete(true);
        }
      }, 15);
    }, delay);
    
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [content, delay]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast({
      title: "Copied to clipboard",
      description: `${title} content copied successfully.`,
    });
    setTimeout(() => setCopied(false), 2000);
  }, [content, title]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000, duration: 0.4 }}
      className="relative group"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={accentClass}>{icon}</span>
          <span className="section-header">{title}</span>
        </div>
        
        {/* Copy Button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: isComplete ? 1 : 0.3 }}
          onClick={handleCopy}
          disabled={!isComplete}
          className={`p-1.5 rounded-md text-muted-foreground ${copyHoverClass} transition-all duration-200 disabled:cursor-not-allowed`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {copied ? (
            <Check className={`w-4 h-4 ${accentClass}`} />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </motion.button>
      </div>
      
      {/* Section Content - Premium sans-serif body */}
      <div className="pl-6">
        <p className="font-body text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
          {displayedContent}
          {!isComplete && (
            <span className={`animate-pulse ${accentClass} ml-0.5`}>▊</span>
          )}
        </p>
      </div>
    </motion.div>
  );
};

type CardVariant = "default" | "rejected";

function deriveVariant(flightPlan: string | null): CardVariant {
  if (!flightPlan) return "default";
  if (flightPlan.includes("STATUS: REJECTED")) return "rejected";
  return "default";
}

const variantStyles = {
  default: {
    border: "border-primary/30",
    glow: "glow-shadow-intense",
    dot: "bg-primary",
    heading: "text-primary",
    accent: "text-primary",
    copyHover: "hover:text-primary hover:bg-primary/10",
    status: "text-primary",
    resetHover: "hover:text-primary hover:bg-primary/10",
    pulseDot: "bg-primary/60",
  },
  rejected: {
    border: "border-[#FF2D00]/50",
    glow: "glow-shadow-rejected",
    dot: "bg-[#FF2D00]",
    heading: "text-[#FF2D00]",
    accent: "text-[#FF2D00]",
    copyHover: "hover:text-[#FF2D00] hover:bg-[#FF2D00]/10",
    status: "text-[#FF2D00]",
    resetHover: "hover:text-[#FF2D00] hover:bg-[#FF2D00]/10",
    pulseDot: "bg-[#FF2D00]/60",
  },
} as const;

const FlightPlanCard = ({ mission, onReset }: FlightPlanCardProps) => {
  const techSpec = mission.flight_plan || `Stack: React + TypeScript, Tailwind CSS, Framer Motion
Database: PostgreSQL with Prisma ORM
Auth: NextAuth.js with OAuth providers
Deployment: Vercel Edge Functions`;

  const agentPrompt = mission.agent_prompt || `You are an expert developer tasked with building "${mission.objective}". Follow best practices for code organization, implement comprehensive error handling, write clean and maintainable code, and ensure accessibility compliance. Prioritize performance optimization and security measures throughout the development process.`;

  const variant = deriveVariant(mission.flight_plan);
  const v = variantStyles[variant];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-2xl"
    >
      <div className={`flight-card rounded-2xl border ${v.border} ${v.glow} p-px`}>
        <div className="rounded-[calc(1rem-1px)] bg-background/95 backdrop-blur-xl p-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-between mb-6 pb-4 border-b border-border/30"
          >
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${v.dot} animate-pulse`} />
              <h2 className={`text-lg font-semibold tracking-tight ${v.heading}`}>
                Flight Plan
              </h2>
            </div>

            {/* Reset Button */}
            {onReset && (
              <motion.button
                onClick={onReset}
                className={`p-2 rounded-md text-muted-foreground ${v.resetHover} transition-all duration-200`}
                whileHover={{ scale: 1.05, rotate: -180 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <RotateCcw className="w-4 h-4" />
              </motion.button>
            )}
          </motion.div>

          {/* Sections - Non-collapsible, compact layout */}
          <div className="space-y-6">
            <Section
              title="OBJECTIVE"
              icon={<Target className="w-4 h-4" />}
              content={mission.objective}
              delay={300}
              accentClass={v.accent}
              copyHoverClass={v.copyHover}
            />

            <div className="border-t border-border/20" />

            <Section
              title="TECH SPEC"
              icon={<Cpu className="w-4 h-4" />}
              content={techSpec}
              delay={800}
              accentClass={v.accent}
              copyHoverClass={v.copyHover}
            />

            <div className="border-t border-border/20" />

            <Section
              title="AGENT PROMPT"
              icon={<Terminal className="w-4 h-4" />}
              content={agentPrompt}
              delay={1300}
              accentClass={v.accent}
              copyHoverClass={v.copyHover}
            />
          </div>

          {/* Footer with status */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="flex items-center justify-between pt-5 mt-5 border-t border-border/30"
          >
            <span className="font-mono text-xs text-muted-foreground">
              Status:{" "}
              <span className={v.status}>
                {variant === "rejected" ? "Rejected" : "Ready for execution"}
              </span>
            </span>
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${v.pulseDot}`}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, delay: i * 0.2, repeat: Infinity }}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default FlightPlanCard;
