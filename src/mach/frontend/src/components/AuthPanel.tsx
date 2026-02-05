import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Mode = "sign_in" | "sign_up";

const AuthPanel = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isFormValid = email && validateEmail(email) && password.length >= 6;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!validateEmail(email)) {
        throw new Error("Please enter a valid email address");
      }

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      if (mode === "sign_in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        setSuccess("Signed in successfully!");
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        setSuccess("Account created! Check your email to confirm.");
        setEmail("");
        setPassword("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeSwitch = (newMode: Mode) => {
    setMode(newMode);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="w-full">
      {/* Tab switching */}
      <div className="flex gap-4 mb-8 border-b border-white/10 pb-1">
        <motion.button
          type="button"
          onClick={() => handleModeSwitch("sign_in")}
          className={`px-4 py-3 text-sm font-semibold transition-all relative ${
            mode === "sign_in"
              ? "text-transparent bg-gradient-to-r from-[#FF00FF] to-[#00FFFF] bg-clip-text"
              : "text-[#A1A8B3] hover:text-[#F5F7FA]"
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Sign In
          {mode === "sign_in" && (
            <motion.div
              layoutId="underline"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#FF00FF] to-[#00FFFF]"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
        </motion.button>

        <motion.button
          type="button"
          onClick={() => handleModeSwitch("sign_up")}
          className={`px-4 py-3 text-sm font-semibold transition-all relative ${
            mode === "sign_up"
              ? "text-transparent bg-gradient-to-r from-[#FF00FF] to-[#00FFFF] bg-clip-text"
              : "text-[#A1A8B3] hover:text-[#F5F7FA]"
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Sign Up
          {mode === "sign_up" && (
            <motion.div
              layoutId="underline"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#FF00FF] to-[#00FFFF]"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        <motion.form
          key={mode}
          onSubmit={submit}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="space-y-5"
        >
          {/* Form title and description */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#F5F7FA] mb-2">
              {mode === "sign_in" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-sm text-[#A1A8B3]">
              {mode === "sign_in"
                ? "Sign in to your MACH account to continue"
                : "Join MACH to start commanding missions"}
            </p>
          </div>

          {/* Email input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#F5F7FA]">Email</label>
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
                  <CheckCircle2 className="w-5 h-5 text-[#00FFFF]" />
                </motion.div>
              )}
            </div>
          </div>

          {/* Password input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-[#F5F7FA]">
                Password
              </label>
              {mode === "sign_in" && (
                <motion.button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-xs text-[#00FFFF] hover:text-[#FF00FF] transition-colors"
                  disabled={isLoading}
                  whileHover={{ scale: 1.05 }}
                >
                  Forgot password?
                </motion.button>
              )}
            </div>
            <div className="relative group">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                className="w-full px-4 py-3 pr-12 rounded-lg bg-white/5 border border-white/10 text-[#F5F7FA] placeholder:text-[#A1A8B3] font-mono text-sm transition-all focus:outline-none focus:border-[#00FFFF] focus:bg-white/10 focus:shadow-lg focus:shadow-[#00FFFF]/20 disabled:opacity-50 disabled:cursor-not-allowed group-hover:border-white/20"
                required
                minLength={6}
              />
              <motion.button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A8B3] hover:text-[#F5F7FA] transition-colors disabled:opacity-50"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </motion.button>
            </div>
            {password && password.length < 6 && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-[#A1A8B3]"
              >
                Password must be at least 6 characters
              </motion.p>
            )}
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

          {/* Success message */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30"
              >
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <p className="text-sm text-green-400">{success}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit button */}
          <motion.button
            type="submit"
            disabled={isLoading || !isFormValid}
            whileHover={isFormValid && !isLoading ? { scale: 1.02 } : {}}
            whileTap={isFormValid && !isLoading ? { scale: 0.98 } : {}}
            className="w-full py-3 px-4 rounded-lg font-semibold text-[#0F172A] transition-all disabled:opacity-60 disabled:cursor-not-allowed relative overflow-hidden group mt-2"
            style={{
              background:
                isFormValid && !isLoading
                  ? "linear-gradient(135deg, #FF00FF 0%, #00FFFF 100%)"
                  : "linear-gradient(135deg, #6B5280 0%, #1B5E75 100%)",
            }}
          >
            {/* Shimmer effect on hover */}
            {isFormValid && !isLoading && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
            )}

            <div className="relative flex items-center justify-center gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : mode === "sign_in" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </div>
          </motion.button>

          {/* Footer */}
          <div className="flex items-center justify-center gap-1 text-sm text-[#A1A8B3] pt-2">
            {mode === "sign_in" ? (
              <>
                <span>Don't have an account?</span>
                <motion.button
                  type="button"
                  onClick={() => handleModeSwitch("sign_up")}
                  disabled={isLoading}
                  className="text-transparent bg-gradient-to-r from-[#FF00FF] to-[#00FFFF] bg-clip-text font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Sign up
                </motion.button>
              </>
            ) : (
              <>
                <span>Already have an account?</span>
                <motion.button
                  type="button"
                  onClick={() => handleModeSwitch("sign_in")}
                  disabled={isLoading}
                  className="text-transparent bg-gradient-to-r from-[#FF00FF] to-[#00FFFF] bg-clip-text font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Sign in
                </motion.button>
              </>
            )}
          </div>
        </motion.form>
      </AnimatePresence>
    </div>
  );
};

export default AuthPanel;
