import { FormEvent, useState } from "react";
import { getSupabaseClient } from "../lib/supabaseClient";

type AuthMode = "sign-in" | "sign-up";

interface AuthFormProps {
  onSuccess?: () => void;
}

const AuthForm = ({ onSuccess }: AuthFormProps) => {
  const supabase = getSupabaseClient();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleMode = () => {
    setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please provide both email and password.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "sign-in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (signInError) {
          throw signInError;
        }
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password
        });
        if (signUpError) {
          throw signUpError;
        }
      }
      onSuccess?.();
    } catch (authError: unknown) {
      if (authError && typeof authError === "object" && "message" in authError) {
        setError((authError as { message: string }).message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" role="presentation">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1 className="auth-title">
          Loopi routines
          <span className="auth-subtitle">
            {mode === "sign-in"
              ? "Sign in to manage your child's routines."
              : "Create an account to get started."}
          </span>
        </h1>
        <label className="auth-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          placeholder="you@example.com"
          autoComplete="email"
          className="auth-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={loading}
        />

        <label className="auth-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          className="auth-input"
          placeholder="8+ characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={loading}
        />

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
        </button>

        <button
          type="button"
          className="auth-toggle"
          onClick={toggleMode}
          disabled={loading}
        >
          {mode === "sign-in"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
};

export default AuthForm;
