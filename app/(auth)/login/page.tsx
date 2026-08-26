"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { Loader2, LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { success, error } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login({ email, password });
      success("Welcome back!");
      router.push("/dashboard");
    } catch (err: any) {
      error(err?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl border border-base-200 p-6 sm:p-8 space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-base-content tracking-tight">
          Sign In to CampFlow
        </h2>
        <p className="text-xs text-base-content/60">
          Enter your staff or owner credentials to access your park
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label text-xs font-semibold py-1">Email Address</label>
          <input
            type="email"
            placeholder="admin@campflow.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input input-bordered input-sm sm:input-md w-full"
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label text-xs font-semibold py-1">Password</label>
          </div>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input input-bordered input-sm sm:input-md w-full"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full mt-2 font-bold shadow-sm gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          Sign In
        </button>
      </form>

      <div className="text-center text-xs text-base-content/70">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-bold text-primary hover:underline">
          Register your RV park
        </Link>
      </div>
    </div>
  );
}
