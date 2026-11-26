import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="admin-auth-loading">Đang kiểm tra phiên đăng nhập...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
