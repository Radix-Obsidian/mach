import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2, Mail } from "lucide-react";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isEmailValid = email && validateEmail(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (!validateEmail(email)) {
        throw new Error("Please enter a valid email address");
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (resetError) throw resetError;

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0F172A]">
      {/* Animated background gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Magenta orb */}
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

        {/* Cyan orb */}
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
      <div className="relative z-10 w-full max-w-md px-4">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl hover:border-white/20 transition-all duration-300"
          style={{
            boxShadow:
              "0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 0 20px rgba(255, 0, 255, 0.05)",
          }}
        >
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {/* Header with back button */}
                <motion.button
                  onClick={() => navigate(-1)}
                  className="flex items-center gap-2 text-sm text-[#A1A8B3] hover:text-[#F5F7FA] transition-colors mb-6"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </motion.button>

                {/* Title */}
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-[#F5F7FA] mb-2">
                    Reset your password
                  </h1>
                  <p className="text-sm text-[#A1A8B3]">
                    Enter your email address and we'll send you a link to reset
                    your password.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Email input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#F5F7FA]">
                      Email address
                    </label>
                    <div className="relative group">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        disabled={isLoading}
                        className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-[#F5F7FA] placeholder:text-[#A1A8B3] font-mono text-sm transition-all focus:outline-none focus:border-[#FF00FF] focus:bg-white/10 focus:shadow-lg focus:shadow-[#FF00FF]/20 disabled:opacity-50 disabled:cursor-not-allowed group-hover:border-white/20"
                        required
                      />
                      {email && validateEmail(email) && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          <Mail className="w-5 h-5 text-[#00FFFF]" />
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Error message */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30"
                      >
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <p className="text-sm text-red-400">{error}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit button */}
                  <motion.button
                    type="submit"
                    disabled={isLoading || !isEmailValid}
                    whileHover={isEmailValid && !isLoading ? { scale: 1.02 } : {}}
                    whileTap={isEmailValid && !isLoading ? { scale: 0.98 } : {}}
                    className="w-full py-3 px-4 rounded-lg font-semibold text-[#0F172A] transition-all disabled:opacity-60 disabled:cursor-not-allowed relative overflow-hidden group mt-2"
                    style={{
                      background:
                        isEmailValid && !isLoading
                          ? "linear-gradient(135deg, #FF00FF 0%, #00FFFF 100%)"
                          : "linear-gradient(135deg, #6B5280 0%, #1B5E75 100%)",
                    }}
                  >
                    {isEmailValid && !isLoading && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                    )}
                    <div className="relative flex items-center justify-center gap-2">
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        "Send reset link"
                      )}
                    </div>
                  </motion.button>
                </form>
              </motion.div>
            ) : (
              /* Success state */
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <div className="flex justify-center mb-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="p-4 rounded-full bg-gradient-to-r from-[#FF00FF]/20 to-[#00FFFF]/20 border border-white/10"
                  >
                    <CheckCircle2 className="w-8 h-8 text-[#00FFFF]" />
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h2 className="text-2xl font-bold text-[#F5F7FA] mb-2">
                    Check your email
                  </h2>
                  <p className="text-sm text-[#A1A8B3] mb-6">
                    We've sent a password reset link to{" "}
                    <span className="font-mono text-[#00FFFF] break-all">{email}</span>
                  </p>

                  <p className="text-xs text-[#A1A8B3] mb-8">
                    The link will expire in 24 hours. If you don't receive it, check
                    your spam folder or try again.
                  </p>
                </motion.div>

                <motion.button
                  onClick={() => navigate("/app")}
                  className="w-full py-3 px-4 rounded-lg font-semibold text-[#0F172A] bg-gradient-to-r from-[#FF00FF] to-[#00FFFF] transition-all hover:shadow-lg hover:shadow-[#FF00FF]/20"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  Back to sign in
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

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
  );
}
