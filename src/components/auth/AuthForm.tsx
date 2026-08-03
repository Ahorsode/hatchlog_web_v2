"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { signIn } from "next-auth/react";
import GlassCard from "./GlassCard";
import FloatingInput from "./FloatingInput";
import GoogleButton from "./GoogleButton";
import LoadingOverlay from "./LoadingOverlay";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

interface AuthFormProps {
  mode: "login" | "signup";
}

export default function AuthForm({ mode }: AuthFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;

    // Simulate validation/submission logic
    // In a real app, you'd use signIn('credentials', ...) or a server action
    try {
      // Mock delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (password.length < MIN_PASSWORD_LENGTH) {
        setShake(true);
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
        setTimeout(() => setShake(false), 500);
        return;
      }

      // If successful, redirect
      router.push("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-5">
      <AnimatePresence>
        {isLoading && <LoadingOverlay />}
      </AnimatePresence>

      <GlassCard className="w-full max-w-md">
        <motion.div
          key={mode}
          initial={{ opacity: 0, x: mode === "login" ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: mode === "login" ? 20 : -20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="text-center mb-7">
            <h1 className="text-4xl font-bold tracking-normal text-white mb-2">
              {mode === "login" ? "Welcome Back" : "Start Your Farm"}
            </h1>
            <p className="text-gray-400">
              {mode === "login" 
                ? "Sign in to manage your poultry counts" 
                : "Create an account to digitize your records"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <AnimatePresence mode="popLayout">
              {mode === "signup" && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3"
                >
                  <FloatingInput
                    label="Full Name"
                    name="name"
                    type="text"
                    required
                    placeholder=" "
                  />
                  <FloatingInput
                    label="Phone Number"
                    name="phone"
                    type="tel"
                    required
                    placeholder=" "
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <FloatingInput
              label="Email Address"
              name="email"
              type="email"
              required
              placeholder=" "
            />

            <motion.div
              animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
              transition={{ duration: 0.4 }}
            >
              <FloatingInput
                label="Password"
                name="password"
                type="password"
                required
                error={error || undefined}
                placeholder=" "
              />
            </motion.div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-bold transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] active:shadow-none"
            >
              {mode === "login" ? "Sign In" : "Create Account"}
            </motion.button>
          </form>

          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#121212]/50 backdrop-blur-md px-3 text-gray-500">Or continue with</span>
            </div>
          </div>

          <GoogleButton 
            onClick={handleGoogleSignIn} 
            label={mode === "login" ? "Google" : "Sign up with Google"} 
          />

          <div className="mt-7 text-center text-sm text-gray-400">
            {mode === "login" ? (
              <>
                Don't have an account?{" "}
                <Link href="/signup" className="text-blue-400 font-semibold hover:text-blue-300 transition-colors">
                  Create one
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link href="/login" className="text-blue-400 font-semibold hover:text-blue-300 transition-colors">
                  Sign in
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </GlassCard>
    </div>
  );
}
