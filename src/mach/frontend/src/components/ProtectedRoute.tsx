import { ReactNode } from "react";
import { useSession } from "@/hooks/useSession";
import AuthPanel from "./AuthPanel";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-8 h-8 text-transparent bg-gradient-to-r from-[#FF00FF] to-[#00FFFF] bg-clip-text" />
        </motion.div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0F172A]">
        {/* Animated background gradient orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {/* Magenta orb - top left */}
          <motion.div
            animate={{
              x: [0, 100, -100, 0],
              y: [0, -100, 100, 0],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl"
            style={{
              background: "radial-gradient(circle, #FF00FF, transparent)",
            }}
          />

          {/* Cyan orb - bottom right */}
          <motion.div
            animate={{
              x: [0, -100, 100, 0],
              y: [0, 100, -100, 0],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-20 blur-3xl"
            style={{
              background: "radial-gradient(circle, #00FFFF, transparent)",
            }}
          />

          {/* Additional accent orb - top right */}
          <motion.div
            animate={{
              x: [0, -50, 50, 0],
              y: [0, 50, -50, 0],
            }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-10 blur-3xl"
            style={{
              background: "radial-gradient(circle, #FF00FF, transparent)",
            }}
          />

          {/* Subtle grid pattern */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `
                linear-gradient(hsl(300, 100%, 50%) 1px, transparent 1px),
                linear-gradient(90deg, hsl(300, 100%, 50%) 1px, transparent 1px)
              `,
              backgroundSize: "80px 80px",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-2xl px-4 md:px-8">
          <div className="text-center mb-8 md:mb-12">
            {/* Neon chevron logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="flex justify-center mb-6"
            >
              <div className="relative w-16 h-16 md:w-20 md:h-20">
                {/* Chevron shape using neon glow */}
                <svg
                  viewBox="0 0 100 100"
                  className="w-full h-full drop-shadow-lg"
                  fill="none"
                  stroke="url(#neonGradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <defs>
                    <linearGradient
                      id="neonGradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#FF00FF" />
                      <stop offset="100%" stopColor="#00FFFF" />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <polyline points="20,50 50,80 80,50" filter="url(#glow)" />
                  <polyline points="20,30 50,60 80,30" filter="url(#glow)" />
                </svg>

                {/* Glow effect */}
                <motion.div
                  className="absolute inset-0 blur-xl rounded-full"
                  style={{
                    background: "radial-gradient(circle, #FF00FF, transparent)",
                  }}
                  animate={{
                    opacity: [0.4, 0.7, 0.4],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "ease-in-out",
                  }}
                />
              </div>
            </motion.div>

            {/* Welcome text with neon glow */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-3 tracking-tight">
                <span className="text-transparent bg-gradient-to-r from-[#FF00FF] via-[#FF00FF] to-[#00FFFF] bg-clip-text drop-shadow-lg">
                  Welcome to Mach
                </span>
              </h1>
              <p className="text-[#A1A8B3] text-base md:text-lg font-medium">
                Mission-driven AI command hub
              </p>
            </motion.div>
          </div>

          {/* Auth panel with glassmorphism */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 md:p-12 shadow-2xl hover:border-white/20 transition-all duration-300"
            style={{
              boxShadow:
                "0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 0 20px rgba(255, 0, 255, 0.05)",
            }}
          >
            <AuthPanel />
          </motion.div>

          {/* Decorative elements */}
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="fixed bottom-10 left-10 w-2 h-2 rounded-full bg-[#FF00FF]"
          />
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, delay: 1 }}
            className="fixed top-10 right-10 w-2 h-2 rounded-full bg-[#00FFFF]"
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
