"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { Loader2, LogIn, Lock, Mail, Sparkles } from "lucide-react";

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
      success("Welcome back to CampFlow!");
      router.push("/dashboard");
    } catch (err: any) {
      error(err?.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-xl p-6 sm:p-8 space-y-6 shadow-2xl border border-white/30 rounded-2xl">
      <div className="text-center space-y-1.5">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Sign In to CampFlow
        </h2>
        <p className="text-xs text-slate-500 max-w-xs mx-auto">
          Enter your staff or owner credentials to access your campground desk
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label text-xs font-bold text-slate-700 py-1">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              placeholder="you@yourpark.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input input-bordered input-md w-full pl-10 text-sm font-medium bg-white/70 focus:bg-white focus:border-emerald-600"
              required
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label text-xs font-bold text-slate-700 py-1">
              Password
            </label>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input input-bordered input-md w-full pl-10 text-sm bg-white/70 focus:bg-white focus:border-emerald-600"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full mt-2 font-bold shadow-sm gap-2 text-sm h-11"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          Sign In to Dashboard
        </button>
      </form>

     

      <div className="text-center text-xs text-slate-600 pt-1">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-bold text-emerald-700 hover:underline">
          Register your RV park
        </Link>
      </div>
    </div>
  );
}
