"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import apiClient, { ApiClientError } from "@/lib/axios/client";
import { LoginInput, RegisterInput } from "@/lib/validations/auth.schema";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "staff";
  organizationId: string;
  propertyId: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  organization: { id: string; name: string; slug: string } | null;
  property: {
    id: string;
    name: string;
    slug: string;
    phone?: string;
    email?: string;
    checkInTime?: string;
    checkOutTime?: string;
    taxRatePercent?: number;
    quietHours?: string;
    rules?: string[];
    amenities?: string[];
  } | null;
  isLoading: boolean;
  login: (credentials: LoginInput) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organization, setOrganization] = useState<any | null>(null);
  const [property, setProperty] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshSession = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get("/api/auth/me");
      if (res.data?.success && res.data?.data) {
        const { user: u, organization: o, property: p } = res.data.data;
        setUser({
          id: u._id || u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          organizationId: u.organizationId,
          propertyId: p?._id || p?.id,
        });
        setOrganization(o);
        setProperty(p);
      } else {
        setUser(null);
        setOrganization(null);
        setProperty(null);
      }
    } catch {
      setUser(null);
      setOrganization(null);
      setProperty(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const login = async (credentials: LoginInput) => {
    setIsLoading(true);
    try {
      const res = await apiClient.post("/api/auth/login", credentials);
      if (res.data?.success) {
        const { user: u, organization: o, property: p, token } = res.data.data;
        if (token && typeof window !== "undefined") {
          localStorage.setItem("rv_auth_token", token);
        }
        setUser(u);
        setOrganization(o);
        setProperty(p);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterInput) => {
    setIsLoading(true);
    try {
      const res = await apiClient.post("/api/auth/register", data);
      if (res.data?.success) {
        const { user: u, organization: o, property: p, token } = res.data.data;
        if (token && typeof window !== "undefined") {
          localStorage.setItem("rv_auth_token", token);
        }
        setUser(u);
        setOrganization(o);
        setProperty(p);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient.post("/api/auth/logout");
      if (typeof window !== "undefined") {
        localStorage.removeItem("rv_auth_token");
      }
    } catch {
      // Continue cleanup
    } finally {
      setUser(null);
      setOrganization(null);
      setProperty(null);
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        property,
        isLoading,
        login,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
