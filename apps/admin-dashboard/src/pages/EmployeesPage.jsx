import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Plus, UserRoundPlus } from "lucide-react";
import { operationsApi } from "../api/operationsApi";
import { EmptyState, PageError, PageLoading, errorMessage } from "../components/PageState";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ fullName: "", email: "" });
  const [verification, setVerification] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEmployees(await operationsApi.employees()); setError(""); }
    catch (err) { setError(errorMessage(err, "Không tải được danh sách nhân viên.")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function createEmployee(event) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      await operationsApi.createEmployee({ fullName: form.fullName.trim(), email: form.email.trim() || null });
      setForm({ fullName: "", email: "" });
      setNotice("Đã thêm nhân viên.");
      await load();
    } catch (err) { setError(errorMessage(err, "Không tạo được nhân viên.")); }
    finally { setSaving(false); }
  }

  async function toggleStatus(employee) {
    const status = employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    if (!window.confirm(`${status === "INACTIVE" ? "Vô hiệu hóa" : "Kích hoạt lại"} ${employee.full_name}?`)) return;
    try { await operationsApi.setEmployeeStatus(employee.id, status); await load(); }
    catch (err) { setError(errorMessage(err, "Không cập nhật được nhân viên.")); }
  }

  async function generateCode(employee) {
    try {
      const result = await operationsApi.verificationCode(employee.id);
      setVerification({ ...result, employee });
      setError("");
    } catch (err) { setError(errorMessage(err, "Không tạo được mã xác thực.")); }
  }

  async function copyCode() {
    try { await navigator.clipboard.writeText(verification.code); setNotice("Đã sao chép mã."); }
    catch { setNotice("Hãy chọn và sao chép mã xác thực bên dưới."); }
  }

  return (
    <div className="product-page">
      <div className="page-header"><div><h1>Nhân viên</h1><p>Quản lý nhân viên và liên kết tài khoản nhận diện trên các kênh.</p></div><button className="btn-action btn-secondary" onClick={load} disabled={loading}>Làm mới</button></div>
      {error && <PageError message={error} />}{notice && <p className="notice" role="status">{notice}</p>}
      <section className="panel"><div className="panel-heading"><div><h2>Thêm nhân viên</h2><p>Sau khi tạo, sinh mã xác thực để nhân viên liên kết tài khoản chat.</p></div><UserRoundPlus size={20} /></div>
        <form className="inline-form employee-form" onSubmit={createEmployee}><label>Họ tên<input value={form.fullName} maxLength={150} required onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="Nguyễn Văn A" /></label><label>Email (không bắt buộc)<input type="email" value={form.email} maxLength={255} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="sales@example.com" /></label><button className="btn-action btn-primary" disabled={saving}><Plus size={16} />{saving ? "Đang lưu..." : "Thêm nhân viên"}</button></form>
      </section>
      <section className="panel"><div className="panel-heading"><div><h2>Danh sách nhân viên</h2><p>{employees.length} nhân viên</p></div></div>
        {loading ? <PageLoading /> : employees.length === 0 ? <EmptyState>Chưa có nhân viên.</EmptyState> : <div className="table-wrap"><table><thead><tr><th>Nhân viên</th><th>Email</th><th>Kênh đã liên kết</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{employees.map(employee => <tr key={employee.id}><td><strong>{employee.full_name}</strong><small className="table-subline">ID {employee.id}</small></td><td>{employee.email || "—"}</td><td>{employee.linked_platforms?.length ? employee.linked_platforms.join(", ") : <span className="muted">Chưa xác thực</span>}</td><td><span className={`status-pill ${employee.status === "ACTIVE" ? "success" : "muted-pill"}`}>{employee.status}</span></td><td><div className="table-actions"><button className="small-button" onClick={() => generateCode(employee)}>Tạo mã xác thực</button><button className="small-button" onClick={() => toggleStatus(employee)}>{employee.status === "ACTIVE" ? "Vô hiệu hóa" : "Kích hoạt"}</button></div></td></tr>)}</tbody></table></div>}
      </section>
      {verification && <div className="modal-backdrop" role="presentation" onClick={() => setVerification(null)}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="verify-title" onClick={e => e.stopPropagation()}><button className="dialog-close" aria-label="Đóng" onClick={() => setVerification(null)}>×</button><h2 id="verify-title">Mã liên kết tài khoản</h2><p>Nhân viên: <strong>{verification.employee.full_name}</strong>. Gửi mã này riêng cho nhân viên; mã chỉ dùng một lần.</p><div className="verification-code">{verification.code}</div><p className="muted">Hết hạn: {new Date(verification.expiresAt).toLocaleString("vi-VN")}</p><button className="btn-action btn-primary" onClick={copyCode}><Copy size={16} /> Sao chép mã</button></section></div>}
    </div>
  );
}
