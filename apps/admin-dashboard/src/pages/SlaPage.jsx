import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { operationsApi } from "../api/operationsApi";
import { EmptyState, PageError, PageLoading, errorMessage } from "../components/PageState";

const date = value => value ? new Date(value).toLocaleString("vi-VN") : "—";
const elapsed = (start, end) => `${Math.max(0, Math.floor((new Date(end) - new Date(start)) / 60000))} phút thực tế`;

export default function SlaPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("WAITING");
  const [platform, setPlatform] = useState("ALL");
  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await operationsApi.listSlas({ status, platform, limit: 200 })); setError(""); }
    catch (err) { setError(errorMessage(err, "Không tải được danh sách SLA.")); }
    finally { setLoading(false); }
  }, [status, platform]);
  useEffect(() => { load(); }, [load]);

  return <div className="product-page">
    <div className="page-header"><div><h1>Theo dõi SLA</h1><p>Đồng hồ chờ chỉ chạy 08:00–12:00, 13:00–17:00 và 18:00–23:00 mỗi ngày; thời gian đã phản hồi hiển thị theo thời gian thực.</p></div><button className="btn-action btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? "spinner" : ""} /> Làm mới</button></div>
    {error && <PageError message={error} onRetry={load} />}
    <div className="toolbar"><label>Trạng thái<select value={status} onChange={e => setStatus(e.target.value)}><option value="WAITING">Đang chờ</option><option value="RESPONDED">Đã phản hồi</option><option value="CANCELLED">Đã hủy</option><option value="ALL">Tất cả</option></select></label><label>Kênh<select value={platform} onChange={e => setPlatform(e.target.value)}><option value="ALL">Tất cả</option><option value="TELEGRAM">Telegram</option><option value="LARK">Lark</option><option value="WHATSAPP">WhatsApp</option></select></label><span className="muted">Tối đa 200 lượt gần nhất</span></div>
    <section className="panel">{loading ? <PageLoading /> : rows.length === 0 ? <EmptyState>Không có lượt SLA phù hợp bộ lọc.</EmptyState> : <div className="table-wrap"><table><thead><tr><th>Nhóm / nội dung</th><th>Kênh</th><th>Bắt đầu</th><th>Đã chờ / phản hồi</th><th>Nhắc</th><th>Phản hồi bởi</th><th>Kết quả</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.group_name || row.external_chat_id}</strong><small className="table-subline message-preview">{row.customer_message || "Tin nhắn không có nội dung văn bản"}</small></td><td>{row.platform}</td><td>{date(row.waiting_started_at)}</td><td>{row.status === "WAITING" ? `${Math.max(0, Math.floor(Number(row.sla_elapsed_minutes || 0)))} phút SLA` : row.responded_at ? elapsed(row.waiting_started_at, row.responded_at) : "—"}</td><td>{row.reminder_count}</td><td>{row.response_employee || "—"}</td><td><span className={`status-pill ${row.status === "RESPONDED" ? "success" : row.status === "WAITING" ? (new Date(row.first_deadline_at) < new Date() ? "danger" : "warning") : "muted-pill"}`}>{row.status === "WAITING" && new Date(row.first_deadline_at) < new Date() ? "OVERDUE" : row.status}</span></td></tr>)}</tbody></table></div>}</section>
  </div>;
}
