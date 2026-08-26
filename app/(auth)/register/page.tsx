"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { Loader2, Building, User, Mail, Phone, Lock, Sparkles } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const { success, error } = useToast();

  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await register({
        name,
        organizationName,
        email,
        phone,
        password,
      });
      success("Park registered successfully! Welcome to CampFlow.");
      router.push("/dashboard");
    } catch (err: any) {
      error(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-xl p-6 sm:p-8 space-y-6 shadow-2xl border border-white/30 rounded-2xl">
      <div className="text-center space-y-1.5">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Create Your Campground Account
        </h2>
        <p className="text-xs text-slate-500 max-w-xs mx-auto">
          Get started with instant site inventory and visual calendar booking management
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label text-xs font-bold text-slate-700 py-1">
            Campground / RV Park Name
          </label>
          <div className="relative">
            <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Whispering Pines RV Resort"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className="input input-bordered input-md w-full pl-10 text-sm font-semibold bg-white/70 focus:bg-white focus:border-emerald-600"
              required
            />
          </div>
        </div>

        <div>
          <label className="label text-xs font-bold text-slate-700 py-1">
            Owner / Manager Name
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Sarah Jenkins"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input input-bordered input-md w-full pl-10 text-sm bg-white/70 focus:bg-white focus:border-emerald-600"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="label text-xs font-bold text-slate-700 py-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                placeholder="sarah@park.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input input-bordered input-md w-full pl-9 text-xs sm:text-sm bg-white/70 focus:bg-white focus:border-emerald-600"
                required
              />
            </div>
          </div>

          <div>
            <label className="label text-xs font-bold text-slate-700 py-1">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                placeholder="(555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input input-bordered input-md w-full pl-9 text-xs sm:text-sm font-mono bg-white/70 focus:bg-white focus:border-emerald-600"
                required
              />
            </div>
          </div>
        </div>

        <div>
          <label className="label text-xs font-bold text-slate-700 py-1">
            Create Password (min 6 characters)
          </label>
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
          className="btn btn-primary w-full mt-2 font-bold shadow-sm h-11 text-sm gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Complete Registration"}
        </button>
      </form>

      <div className="text-center text-xs text-slate-600 pt-1">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-emerald-700 hover:underline">
          Sign In
        </Link>
      </div>
    </div>
  );
}
