import { useCallback, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { operationsApi } from "../api/operationsApi";
import { PageError, PageLoading, errorMessage } from "../components/PageState";

export default function SettingsPage() {
  const [policy, setPolicy] = useState(null);
  const [form, setForm] = useState({ firstResponseMinutes: 10, reminderIntervalMinutes: 10, newSlaGapMinutes: 5 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await operationsApi.settings(); setPolicy(result); setForm({ firstResponseMinutes: result.first_response_minutes, reminderIntervalMinutes: result.reminder_interval_minutes, newSlaGapMinutes: result.new_sla_gap_minutes }); setError(""); }
    catch (err) { setError(errorMessage(err, "Không tải được cài đặt.")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function save(event) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try { const result = await operationsApi.updateSettings({ firstResponseMinutes: Number(form.firstResponseMinutes), reminderIntervalMinutes: Number(form.reminderIntervalMinutes), newSlaGapMinutes: Number(form.newSlaGapMinutes) }); setPolicy(result); setNotice("Đã lưu chính sách SLA. Thời hạn và lịch nhắc của các SLA đang mở đã được tính lại theo giờ hỗ trợ."); }
    catch (err) { setError(errorMessage(err, "Không lưu được cài đặt.")); }
    finally { setSaving(false); }
  }
  if (loading) return <PageLoading label="Đang tải cài đặt..." />;
  return <div className="product-page"><div className="page-header"><div><h1>Cài đặt SLA</h1><p>Thiết lập khoảng gom tin, thời gian phản hồi và nhịp nhắc nhân viên.</p></div></div>{error && <PageError message={error} onRetry={load} />}{notice && <p className="notice" role="status">{notice}</p>}<section className="panel settings-panel"><form className="settings-form" onSubmit={save}><label>Khoảng cách để tạo SLA mới (phút)<input type="number" min="1" max="240" required value={form.newSlaGapMinutes} onChange={e => setForm({ ...form, newSlaGapMinutes: e.target.value })} /><small>Nếu cùng khách nhắn sau ngưỡng này kể từ lúc SLA gần nhất mở, hệ thống tạo SLA mới.</small></label><label>Thời hạn phản hồi đầu tiên (phút hỗ trợ)<input type="number" min="1" max="240" required value={form.firstResponseMinutes} onChange={e => setForm({ ...form, firstResponseMinutes: e.target.value })} /><small>Đồng hồ chạy 08:00–12:00, 13:00–17:00, 18:00–23:00 mỗi ngày. Tin đến ngoài giờ sẽ bắt đầu tính từ đầu khung tiếp theo.</small></label><label>Khoảng cách giữa các lần nhắc (phút hỗ trợ)<input type="number" min="1" max="240" required value={form.reminderIntervalMinutes} onChange={e => setForm({ ...form, reminderIntervalMinutes: e.target.value })} /><small>Reminder chỉ được gửi trong các khung hỗ trợ; thời gian nghỉ không tính vào nhịp nhắc.</small></label><div className="settings-note">Khi đổi cài đặt, deadline và lịch nhắc của các SLA đang mở được tính lại theo giờ hỗ trợ.</div><button className="btn-action btn-primary" disabled={saving}><Save size={16} />{saving ? "Đang lưu..." : "Lưu cài đặt"}</button>{policy?.updated_at && <small className="muted">Cập nhật lần cuối: {new Date(policy.updated_at).toLocaleString("vi-VN")}</small>}</form></section></div>;
}
