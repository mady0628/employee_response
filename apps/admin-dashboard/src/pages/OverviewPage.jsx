import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Users, Clock3, CircleAlert, CircleCheck } from "lucide-react";
import { operationsApi } from "../api/operationsApi";
import { connectionApi } from "../api/connectionApi";
import { EmptyState, PageError, PageLoading, errorMessage } from "../components/PageState";

const number = value => Number(value || 0).toLocaleString("vi-VN");
const formatDate = value => value ? new Date(value).toLocaleString("vi-VN") : "—";

export default function OverviewPage() {
  const [data, setData] = useState(null);
  const [connections, setConnections] = useState([]);
  const [slas, setSlas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summary, active, allConnections] = await Promise.all([
        operationsApi.overview(7),
        operationsApi.listSlas({ status: "WAITING", limit: 8 }),
        connectionApi.getAll()
      ]);
      setData(summary);
      setSlas(active || []);
      setConnections(allConnections || []);
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Không tải được dữ liệu tổng quan."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <PageLoading label="Đang tải tổng quan..." />;
  if (error && !data) return <PageError message={error} onRetry={load} />;

  const metrics = [
    { label: "SLA đang chờ", value: number(data?.waiting), icon: Clock3, tone: "blue" },
    { label: "Đã quá hạn", value: number(data?.overdue), icon: CircleAlert, tone: "red" },
    { label: "Đã phản hồi hôm nay", value: number(data?.responded_today), icon: CircleCheck, tone: "green" },
    { label: "Đạt SLA · 7 ngày", value: data?.compliance_percent == null ? "—" : `${data.compliance_percent}%`, icon: Users, tone: "violet" }
  ];

  return (
    <div className="product-page">
      <div className="page-header">
        <div><h1>Tổng quan</h1><p>Tình hình phản hồi khách hàng và các kết nối đang giám sát.</p></div>
        <button className="btn-action btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? "spinner" : ""} /> Làm mới</button>
      </div>
      {error && <PageError message={error} onRetry={load} />}
      <div className="metric-grid">
        {metrics.map(item => { const Icon = item.icon; return <article className="metric-card" key={item.label}><span className={`metric-icon ${item.tone}`}><Icon size={19} /></span><div><p>{item.label}</p><strong>{item.value}</strong></div></article>; })}
      </div>
      <section className="panel">
        <div className="panel-heading"><div><h2>Kết nối kênh</h2><p>{connections.length} kết nối đã cấu hình</p></div><Link className="text-link" to="/connections">Quản lý kết nối</Link></div>
        {connections.length === 0 ? <EmptyState>Chưa có kết nối.</EmptyState> : <div className="connection-status-list">{connections.slice(0, 6).map(connection => <div className="connection-status-row" key={connection.id}><span className={`status-dot ${connection.connection_status === "CONNECTED" ? "online" : "offline"}`} /><strong>{connection.display_name || connection.name}</strong><span className="muted">{connection.platform}</span><span className="status-pill">{connection.connection_status}</span></div>)}</div>}
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h2>Khách đang chờ phản hồi</h2><p>Hiển thị tối đa 8 SLA đang mở, ưu tiên SLA quá hạn.</p></div><Link className="text-link" to="/sla">Xem danh sách SLA</Link></div>
        {slas.length === 0 ? <EmptyState>Hiện không có SLA đang chờ.</EmptyState> : <div className="table-wrap"><table><thead><tr><th>Nhóm</th><th>Kênh</th><th>Bắt đầu chờ</th><th>Hạn phản hồi</th><th>Nhắc</th><th>Trạng thái</th></tr></thead><tbody>{slas.map(sla => <tr key={sla.id}><td>{sla.group_name || sla.external_chat_id}</td><td>{sla.platform}</td><td>{formatDate(sla.waiting_started_at)}</td><td>{formatDate(sla.first_deadline_at)}</td><td>{sla.reminder_count}</td><td><span className={`status-pill ${new Date(sla.first_deadline_at) < new Date() ? "danger" : "warning"}`}>{new Date(sla.first_deadline_at) < new Date() ? "Quá hạn" : "Đang chờ"}</span></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
