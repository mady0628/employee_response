import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "../components/layout/AdminLayout";
import ConnectionsPage from "../pages/ConnectionsPage";
import OverviewPage from "../pages/OverviewPage";
import EmployeesPage from "../pages/EmployeesPage";
import VerificationCodesPage from "../pages/VerificationCodesPage";
import GroupsPage from "../pages/GroupsPage";
import SlaPage from "../pages/SlaPage";
import ReportsPage from "../pages/ReportsPage";
import SettingsPage from "../pages/SettingsPage";
import LoginPage from "../pages/LoginPage";
import RequireAuth from "../auth/RequireAuth";
import { AuthProvider } from "../auth/AuthContext";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth><AdminLayout /></RequireAuth>}>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/verification-codes" element={<VerificationCodesPage />} />
            <Route path="/sla" element={<SlaPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
