import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Bot,
  Users,
  UserRoundCheck,
  KeyRound,
  Clock,
  ChartNoAxesCombined,
  Settings
} from "lucide-react";

const menus = [
  { label: "Tổng quan", path: "/", icon: LayoutDashboard },
  { label: "Kết nối", path: "/connections", icon: Bot },
  { label: "Nhóm được giám sát", path: "/groups", icon: Users },
  { label: "Nhân viên", path: "/employees", icon: UserRoundCheck },
  { label: "Mã xác thực", path: "/verification-codes", icon: KeyRound },
  { label: "SLA", path: "/sla", icon: Clock },
  { label: "Báo cáo", path: "/reports", icon: ChartNoAxesCombined },
  { label: "Cài đặt", path: "/settings", icon: Settings }
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Bot size={28} />
        <span>Sales Reminder</span>
      </div>
      <nav className="sidebar-menu">
        {menus.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
