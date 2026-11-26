import { createContext, useCallback, useContext, useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await axiosClient.get("/admin/auth/session");
      setUser(response.data?.data || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (username, password) => {
    const response = await axiosClient.post("/admin/auth/login", { username, password });
    setUser(response.data?.data || null);
  }, []);

  const logout = useCallback(async () => {
    try { await axiosClient.post("/admin/auth/logout"); }
    catch { /* The server session may already have expired. */ }
    finally { setUser(null); }
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
