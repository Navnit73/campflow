"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { Loader2 } from "lucide-react";

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
    <div className="card bg-base-100 shadow-xl border border-base-200 p-6 sm:p-8 space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-base-content tracking-tight">
          Create Your Campground Account
        </h2>
        <p className="text-xs text-base-content/60">
          Get started with instant site setups and booking management
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="label text-xs font-semibold py-1">Campground / RV Park Name</label>
          <input
            type="text"
            placeholder="Whispering Pines RV Resort"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            className="input input-bordered input-sm w-full font-medium"
            required
          />
        </div>

        <div>
          <label className="label text-xs font-semibold py-1">Owner / Manager Name</label>
          <input
            type="text"
            placeholder="Sarah Jenkins"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input input-bordered input-sm w-full"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label text-xs font-semibold py-1">Email Address</label>
            <input
              type="email"
              placeholder="sarah@park.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input input-bordered input-sm w-full"
              required
            />
          </div>

          <div>
            <label className="label text-xs font-semibold py-1">Phone Number</label>
            <input
              type="tel"
              placeholder="(555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input input-bordered input-sm w-full font-mono"
              required
            />
          </div>
        </div>

        <div>
          <label className="label text-xs font-semibold py-1">Create Password (min 6 chars)</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input input-bordered input-sm w-full"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full mt-3 font-bold shadow-sm"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Complete Registration"}
        </button>
      </form>

      <div className="text-center text-xs text-base-content/70">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-primary hover:underline">
          Sign In
        </Link>
      </div>
    </div>
  );
}
