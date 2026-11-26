import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../../auth/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }
  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <header className="admin-header">
          <h3>Sales Reminder Admin</h3>
          <div className="admin-header-user"><span className="admin-user">{user?.username || "Quản trị"}</span><button className="admin-logout" type="button" onClick={handleLogout}>Đăng xuất</button></div>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
