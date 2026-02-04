import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Mode = "sign_in" | "sign_up";

const AuthPanel = () => {
  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === "sign_in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl p-6">
      <h2 className="text-lg font-semibold tracking-tight">
        {mode === "sign_in" ? "Sign in" : "Create account"}
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        You must be signed in to create and view missions.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-mono">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-sm font-mono focus:outline-none"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-mono">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-sm font-mono focus:outline-none"
            required
          />
        </div>

        {error && <p className="text-xs text-red-400 font-mono">{error}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-mono disabled:opacity-60"
        >
          {isLoading ? "Working..." : mode === "sign_in" ? "Sign in" : "Sign up"}
        </button>
      </form>

      <div className="mt-4 text-xs font-mono text-muted-foreground">
        {mode === "sign_in" ? (
          <button
            type="button"
            onClick={() => setMode("sign_up")}
            className="underline underline-offset-4"
          >
            Need an account? Sign up
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMode("sign_in")}
            className="underline underline-offset-4"
          >
            Already have an account? Sign in
          </button>
        )}
      </div>
    </div>
  );
};

export default AuthPanel;
