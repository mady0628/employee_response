import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="admin-auth-loading">Đang kiểm tra phiên đăng nhập...</div>;
  if (user) return <Navigate to={location.state?.from?.pathname || "/"} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Không thể đăng nhập. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="admin-login-page">
    <form className="admin-login-card" onSubmit={handleSubmit}>
      <div className="admin-login-brand">Sales Reminder</div>
      <h1>Đăng nhập dashboard</h1>
      <p>Đăng nhập bằng tài khoản quản trị của bạn.</p>
      <label htmlFor="admin-username">Tên đăng nhập</label>
      <input id="admin-username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required autoFocus />
      <label htmlFor="admin-password">Mật khẩu</label>
      <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
      {error && <p className="admin-login-error" role="alert">{error}</p>}
      <button className="btn-action btn-primary" type="submit" disabled={submitting}>{submitting ? "Đang đăng nhập..." : "Đăng nhập"}</button>
    </form>
  </main>;
}
