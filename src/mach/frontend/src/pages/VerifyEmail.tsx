import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  RotateCcw,
} from "lucide-react";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  // Countdown for resend button
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      prevInput?.focus();
    }
  };

  const isCodeComplete = code.every((digit) => digit !== "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = code.join("");

    if (otpCode.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Verify the OTP code using Supabase
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "email",
      });

      if (verifyError) {
        throw new Error(verifyError.message || "Invalid verification code");
      }

      setVerified(true);

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate("/app");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    setError(null);

    try {
      // Resend OTP code
      const { error: resendError } = await supabase.auth.signInWithOtp({
        email,
      });

      if (resendError) throw resendError;

      setResendCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code");
    } finally {
      setResendLoading(false);
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
            {!verified ? (
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
                    Verify your email
                  </h1>
                  <p className="text-sm text-[#A1A8B3]">
                    Enter the 6-digit code we sent to{" "}
                    <span className="font-mono text-[#00FFFF] break-all">{email}</span>
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* OTP code inputs */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-[#F5F7FA]">
                      Verification code
                    </label>
                    <div className="flex gap-3 justify-between">
                      {code.map((digit, index) => (
                        <motion.input
                          key={index}
                          id={`code-${index}`}
                          type="text"
                          inputMode="numeric"
                          value={digit}
                          onChange={(e) => handleCodeChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          maxLength={1}
                          disabled={isLoading}
                          className="w-12 h-14 rounded-lg bg-white/5 border border-white/10 text-center text-[#F5F7FA] font-mono text-xl font-bold transition-all focus:outline-none focus:border-[#FF00FF] focus:bg-white/10 focus:shadow-lg focus:shadow-[#FF00FF]/20 disabled:opacity-50 disabled:cursor-not-allowed hover:border-white/20"
                          initial={{ scale: 1 }}
                          whileFocus={{ scale: 1.05 }}
                          animate={
                            digit
                              ? {
                                  background:
                                    "linear-gradient(135deg, rgba(255, 0, 255, 0.1), rgba(0, 255, 255, 0.1))",
                                }
                              : {}
                          }
                        />
                      ))}
                    </div>
                    <p className="text-xs text-[#A1A8B3] pt-1">
                      Digits only. Spaces will be ignored.
                    </p>
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
                    disabled={isLoading || !isCodeComplete}
                    whileHover={!isLoading && isCodeComplete ? { scale: 1.02 } : {}}
                    whileTap={!isLoading && isCodeComplete ? { scale: 0.98 } : {}}
                    className="w-full py-3 px-4 rounded-lg font-semibold text-[#0F172A] transition-all disabled:opacity-60 disabled:cursor-not-allowed relative overflow-hidden group mt-2"
                    style={{
                      background:
                        !isLoading && isCodeComplete
                          ? "linear-gradient(135deg, #FF00FF 0%, #00FFFF 100%)"
                          : "linear-gradient(135deg, #6B5280 0%, #1B5E75 100%)",
                    }}
                  >
                    {!isLoading && isCodeComplete && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                    )}
                    <div className="relative flex items-center justify-center gap-2">
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        "Verify code"
                      )}
                    </div>
                  </motion.button>
                </form>

                {/* Resend code section */}
                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-sm text-[#A1A8B3] text-center mb-3">
                    Didn't receive the code?
                  </p>
                  <motion.button
                    onClick={handleResendCode}
                    disabled={resendCountdown > 0 || resendLoading}
                    whileHover={resendCountdown === 0 && !resendLoading ? { scale: 1.02 } : {}}
                    whileTap={resendCountdown === 0 && !resendLoading ? { scale: 0.98 } : {}}
                    className="w-full py-2 px-4 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed text-[#00FFFF] border border-[#00FFFF]/30 hover:bg-[#00FFFF]/10 hover:border-[#00FFFF]/50"
                  >
                    <div className="flex items-center justify-center gap-2">
                      {resendLoading ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : resendCountdown > 0 ? (
                        <>
                          <RotateCcw className="w-3 h-3" />
                          <span>Resend in {resendCountdown}s</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-3 h-3" />
                          <span>Resend code</span>
                        </>
                      )}
                    </div>
                  </motion.button>
                </div>
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
                    Email verified!
                  </h2>
                  <p className="text-sm text-[#A1A8B3] mb-6">
                    Your email has been successfully verified. Redirecting you now...
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-center justify-center gap-2"
                >
                  <Loader2 className="w-4 h-4 animate-spin text-[#FF00FF]" />
                  <span className="text-sm text-[#A1A8B3]">Redirecting...</span>
                </motion.div>
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
