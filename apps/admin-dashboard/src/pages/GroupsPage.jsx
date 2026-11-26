import { useCallback, useEffect, useState } from "react";
import { Pause, Play, RefreshCw, Ban } from "lucide-react";
import { operationsApi } from "../api/operationsApi";
import { EmptyState, PageError, PageLoading, errorMessage } from "../components/PageState";

const date = value => value ? new Date(value).toLocaleString("vi-VN") : "—";

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const load = useCallback(async () => {
    setLoading(true);
    try { setGroups(await operationsApi.groups()); setError(""); }
    catch (err) { setError(errorMessage(err, "Không tải được danh sách nhóm.")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function changeStatus(group, status) {
    const action = status === "PAUSED" ? "Tạm dừng" : status === "REVOKED" ? "Ngừng theo dõi" : "Kích hoạt lại";
    if (!window.confirm(`${action} nhóm ${group.group_name || group.external_group_id}? SLA đang chờ sẽ bị hủy khi tạm dừng.`)) return;
    try { await operationsApi.setGroupStatus(group.id, status); await load(); }
    catch (err) { setError(errorMessage(err, "Không cập nhật được nhóm.")); }
  }

  const visible = filter === "ALL" ? groups : groups.filter(group => group.status === filter);
  return <div className="product-page">
    <div className="page-header"><div><h1>Nhóm được giám sát</h1><p>Tạm dừng hoặc kích hoạt nhóm. Khi tạm dừng, SLA đang chờ sẽ được hủy.</p></div><button className="btn-action btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? "spinner" : ""} /> Làm mới</button></div>
    {error && <PageError message={error} onRetry={load} />}
    <div className="toolbar"><label>Lọc trạng thái<select value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">Tất cả</option><option value="ACTIVE">Đang theo dõi</option><option value="PAUSED">Tạm dừng</option><option value="REVOKED">Đã ngừng</option></select></label><span className="muted">{visible.length} nhóm</span></div>
    <section className="panel">{loading ? <PageLoading /> : visible.length === 0 ? <EmptyState>Chưa có nhóm phù hợp. Nhóm sẽ xuất hiện sau khi kênh nhận được sự kiện.</EmptyState> : <div className="table-wrap"><table><thead><tr><th>Nhóm</th><th>Kênh / Kết nối</th><th>Trạng thái kênh</th><th>Được phát hiện</th><th>Bắt đầu theo dõi</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{visible.map(group => <tr key={group.id}><td><strong>{group.group_name || "Nhóm chưa có tên"}</strong><small className="table-subline">{group.external_group_id}</small></td><td>{group.platform}<small className="table-subline">{group.connection_name || `#${group.channel_connection_id}`}</small></td><td>{group.connection_status || "—"}</td><td>{date(group.discovered_at)}</td><td>{date(group.monitoring_started_at)}</td><td><span className={`status-pill ${group.status === "ACTIVE" ? "success" : group.status === "PAUSED" ? "warning" : "muted-pill"}`}>{group.status}</span></td><td><div className="table-actions">{group.status !== "ACTIVE" && group.status !== "REVOKED" && <button className="small-button" onClick={() => changeStatus(group, "ACTIVE")}><Play size={14} /> Kích hoạt</button>}{group.status === "ACTIVE" && <button className="small-button" onClick={() => changeStatus(group, "PAUSED")}><Pause size={14} /> Tạm dừng</button>}{group.status !== "REVOKED" && <button className="small-button danger-text" onClick={() => changeStatus(group, "REVOKED")}><Ban size={14} /> Ngừng</button>}</div></td></tr>)}</tbody></table></div>}</section>
  </div>;
}
