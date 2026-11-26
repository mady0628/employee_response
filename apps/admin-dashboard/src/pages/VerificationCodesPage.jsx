import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, RefreshCw } from "lucide-react";
import { operationsApi } from "../api/operationsApi";
import { EmptyState, PageError, PageLoading, errorMessage } from "../components/PageState";

export default function VerificationCodesPage() {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const result = await operationsApi.employees();
      setEmployees(result);
      setEmployeeId(current => result.some(employee => String(employee.id) === current && employee.status === "ACTIVE")
        ? current
        : String(result.find(employee => employee.status === "ACTIVE")?.id || ""));
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Không tải được danh sách nhân viên."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const selectedEmployee = employees.find(employee => String(employee.id) === employeeId && employee.status === "ACTIVE");

  async function generateCode(event) {
    event.preventDefault();
    if (employeeId && !selectedEmployee) return;
    if (generating) return;
    setGenerating(true);
    setError("");
    setNotice("");
    setVerification(null);
    try {
      const result = selectedEmployee
        ? await operationsApi.verificationCode(selectedEmployee.id)
        : await operationsApi.onboardingVerificationCode();
      setVerification(result);
    } catch (err) {
      setError(errorMessage(err, "Không tạo được mã xác thực."));
    } finally {
      setGenerating(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(verification.code);
      setNotice("Đã sao chép mã xác thực.");
    } catch {
      setNotice("Không truy cập được clipboard. Hãy chọn và sao chép mã bên dưới.");
    }
  }

  return (
    <div className="product-page">
      <div className="page-header">
        <div>
          <h1>Mã xác thực</h1>
          <p>Tạo mã một lần để nhân viên liên kết tài khoản Telegram.</p>
        </div>
        <button className="btn-action btn-secondary" onClick={loadEmployees} disabled={loading}>
          <RefreshCw size={15} /> Làm mới
        </button>
      </div>

      {error && <PageError message={error} onRetry={loadEmployees} />}
      {notice && <p className="notice" role="status">{notice}</p>}

      <section className="panel verification-panel">
        <div className="panel-heading">
          <div>
            <h2>Tạo mã liên kết</h2>
            <p>Mã có hiệu lực trong 15 phút và chỉ sử dụng được một lần.</p>
          </div>
          <KeyRound size={20} />
        </div>

        {loading ? <PageLoading label="Đang tải nhân viên..." /> : (
          <form className="verification-form" onSubmit={generateCode}>
            <label htmlFor="verification-employee">Gắn mã với nhân viên (không bắt buộc)</label>
            <div className="verification-form-row">
              <select
                id="verification-employee"
                value={employeeId}
                onChange={event => { setEmployeeId(event.target.value); setVerification(null); setNotice(""); }}
              >
                <option value="">Chưa gắn nhân viên (mã onboarding)</option>
                {employees.map(employee => (
                  <option key={employee.id} value={employee.id} disabled={employee.status !== "ACTIVE"}>
                    {employee.full_name}{employee.status !== "ACTIVE" ? " (đã vô hiệu hóa)" : ""}
                  </option>
                ))}
              </select>
              <button className="btn-action btn-primary" type="submit" disabled={(employeeId !== "" && !selectedEmployee) || generating}>
                <KeyRound size={16} /> {generating ? "Đang tạo mã..." : "Tạo mã xác thực"}
              </button>
            </div>
            {employees.length === 0 && <p className="muted">Chưa có nhân viên. Bạn vẫn có thể tạo mã onboarding.</p>}
          </form>
        )}
      </section>

      {verification && (
        <section className="panel verification-result" aria-live="polite">
          <div className="panel-heading">
            <div>
              <h2>Mã đã tạo</h2>
              <p>{selectedEmployee
                ? `Gửi mã riêng cho ${selectedEmployee.full_name} để liên kết tài khoản.`
                : "Mã chưa gắn với nhân viên. Người dùng đầu tiên xác thực bằng mã này sẽ được tạo thành nhân viên mới."}</p>
            </div>
          </div>
          <div className="verification-code">{verification.code}</div>
          <div className="verification-result-footer">
            <span className="muted">Hết hạn: {new Date(verification.expiresAt).toLocaleString("vi-VN")}</span>
            <button className="btn-action btn-primary" onClick={copyCode}>
              <Copy size={16} /> Sao chép mã
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
