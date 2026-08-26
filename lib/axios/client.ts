import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { ApiResponse } from "@/lib/utils/api-response";

export class ApiClientError extends Error {
  code: string;
  status?: number;
  fields?: Record<string, string>;

  constructor(message: string, code = "API_ERROR", status?: number, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

const apiClient: AxiosInstance = axios.create({
  baseURL: typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: true,
});

// Request Interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // If client-side token is in localStorage, optionally attach Bearer token fallback for hybrid use
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("rv_auth_token");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor
apiClient.interceptors.response.use(
  (response) => {
    // Return response.data directly if standard structure
    return response;
  },
  (error: AxiosError<ApiResponse>) => {
    if (error.response?.data && !error.response.data.success) {
      const errPayload = error.response.data.error;
      return Promise.reject(
        new ApiClientError(
          errPayload.message || "An unexpected error occurred",
          errPayload.code || "UNKNOWN_ERROR",
          error.response.status,
          errPayload.fields
        )
      );
    }

    const message = error.message || "Network request failed. Please check your connection.";
    return Promise.reject(new ApiClientError(message, "NETWORK_ERROR", error.response?.status));
  }
);

export default apiClient;
