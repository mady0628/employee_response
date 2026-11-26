import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { operationsApi } from "../api/operationsApi";
import { EmptyState, PageError, PageLoading, errorMessage } from "../components/PageState";

const TIME_ZONE = "Asia/Ho_Chi_Minh";

function localDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}

function shiftDate(value, days) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function percent(value) {
  return value == null ? "—" : `${Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

function minutes(value) {
  return value == null ? "—" : `${Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} phút`;
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadCsv(report, filters) {
  if (!report) return;
  const lines = [
    ["BÁO CÁO THỜI GIAN PHẢN HỒI", `${report.from} - ${report.to}`, `Múi giờ: ${report.timeZone}`],
    [],
    ["Tổng quan"],
    ["Chỉ số", "Giá trị"],
    ["Tổng lượt hỏi (kể cả ngoài khung)", report.summary.totalInquiries],
    ["Lượt SLA bị hủy", report.summary.cancelled],
    ["Trả lời bằng tin chữ", report.summary.answeredByText],
    ["Trả lời tính cả reaction", report.summary.answeredIncludingReactions],
    ["Đang chờ", report.summary.waiting],
    ["Chờ quá 30 phút SLA (không tính reaction)", report.summary.waitingOver30TextOnly],
    ["Chờ quá 30 phút SLA (tính reaction)", report.summary.waitingOver30IncludingReactions],
    ["Trung vị phút SLA, tin chữ", report.summary.medianResponseSlaMinutesTextOnly],
    ["Trung vị phút SLA, tính reaction", report.summary.medianResponseSlaMinutesIncludingReactions],
    [],
    ["Theo mốc phản hồi"],
    ["Mốc phút", "Tin chữ - số lượt", "Tin chữ - tỷ lệ", "Tính reaction - số lượt", "Tính reaction - tỷ lệ"],
    ...report.summary.thresholds.map(row => [row.minutes, row.textCount, row.textRate, row.includingReactionsCount, row.includingReactionsRate]),
    [],
    ["Theo giờ nhận tin"],
    ["Giờ", "Lượt hỏi", "Đã trả lời chữ", "Đã trả lời tính reaction", "Trong 3 phút chữ", "Tỷ lệ 3 phút chữ", "Trong 3 phút tính reaction", "Tỷ lệ 3 phút tính reaction", "Trong 10 phút chữ", "Tỷ lệ 10 phút chữ", "Trong 10 phút tính reaction", "Tỷ lệ 10 phút tính reaction", "Trung vị phút SLA, tính reaction"],
    ...report.byHour.map(row => {
      const three = row.thresholds.find(item => item.minutes === 3);
      const ten = row.thresholds.find(item => item.minutes === 10);
      return [row.label, row.totalInquiries, row.answeredByText, row.answeredIncludingReactions, three.textCount, three.textRate, three.includingReactionsCount, three.includingReactionsRate, ten.textCount, ten.textRate, ten.includingReactionsCount, ten.includingReactionsRate, row.medianResponseSlaMinutesIncludingReactions];
    }),
    [],
    ["Theo nhóm"],
    ["Nhóm", "Kênh", "Lượt hỏi", "Hủy", "Trả lời chữ", "Tính reaction", "Đang chờ", "Chờ >30p chữ", "Chờ >30p tính reaction", "Trung vị phút SLA chữ", "Trung vị phút SLA tính reaction", "Trong 3 phút chữ", "Tỷ lệ 3 phút chữ", "Trong 3 phút tính reaction", "Tỷ lệ 3 phút tính reaction", "Trong 10 phút chữ", "Tỷ lệ 10 phút chữ", "Trong 10 phút tính reaction", "Tỷ lệ 10 phút tính reaction"],
    ...report.byGroup.map(row => {
      const three = row.thresholds.find(item => item.minutes === 3);
      const ten = row.thresholds.find(item => item.minutes === 10);
      return [row.groupName, row.platform, row.totalInquiries, row.cancelled, row.answeredByText, row.answeredIncludingReactions, row.waiting, row.waitingOver30TextOnly, row.waitingOver30IncludingReactions, row.medianResponseSlaMinutesTextOnly, row.medianResponseSlaMinutesIncludingReactions, three.textCount, three.textRate, three.includingReactionsCount, three.includingReactionsRate, ten.textCount, ten.textRate, ten.includingReactionsCount, ten.includingReactionsRate];
    }),
    [],
    ["Theo ngày"],
    ["Ngày", "Lượt hỏi", "Hủy", "Trả lời chữ", "Tính reaction", "Đang chờ", "Trung vị phút SLA, tính reaction"],
    ...report.byDay.map(row => [row.day, row.totalInquiries, row.cancelled, row.answeredByText, row.answeredIncludingReactions, row.waiting, row.medianResponseSlaMinutesIncludingReactions])
  ];
  const content = lines.map(row => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `sales-response-time-${filters.from}-${filters.to}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function thresholdCell(rows, threshold, field) {
  return rows.find(row => row.minutes === threshold)?.[field];
}

export default function ReportsPage() {
  const today = useMemo(() => localDate(), []);
  const [filters, setFilters] = useState({
    from: shiftDate(today, -13),
    to: today,
    platform: "ALL",
    groupId: "ALL"
  });
  const [report, setReport] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setReport(null);
    try {
      const data = await operationsApi.responseTimeReport(filters);
      setReport(data);
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Không tải được báo cáo thời gian phản hồi."));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    operationsApi.groups()
      .then(rows => setGroups(Array.isArray(rows) ? rows : []))
      .catch(() => setGroups([]));
  }, []);

  const visibleGroups = filters.platform === "ALL"
    ? groups
    : groups.filter(group => group.platform === filters.platform);
  const maxOpened = Math.max(1, ...(report?.byDay || []).map(row => Number(row.totalInquiries)));

  function setFilter(name, value) {
    setFilters(current => ({
      ...current,
      [name]: value,
      ...(name === "platform" ? { groupId: "ALL" } : {})
    }));
  }

  return <div className="product-page">
    <div className="page-header">
      <div>
        <h1>Báo cáo thời gian phản hồi</h1>
        <p>Thống kê lượt hỏi 24/7; đồng hồ SLA tuân theo các khoảng nghỉ đã cấu hình.</p>
      </div>
      <div className="page-actions">
        <button className="btn-action btn-secondary" onClick={() => downloadCsv(report, filters)} disabled={!report?.summary.totalInquiries}>
          <Download size={15} /> Xuất CSV
        </button>
        <button className="btn-action btn-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spinner" : ""} /> Làm mới
        </button>
      </div>
    </div>

    {error && <PageError message={error} onRetry={load} />}

    <div className="toolbar report-toolbar">
      <label>Từ ngày<input type="date" value={filters.from} max={filters.to} onChange={event => setFilter("from", event.target.value)} /></label>
      <label>Đến ngày<input type="date" value={filters.to} min={filters.from} onChange={event => setFilter("to", event.target.value)} /></label>
      <label>Kênh<select value={filters.platform} onChange={event => setFilter("platform", event.target.value)}><option value="ALL">Tất cả</option><option value="TELEGRAM">Telegram</option><option value="LARK">Lark</option><option value="WHATSAPP">WhatsApp</option></select></label>
      <label>Nhóm<select value={filters.groupId} onChange={event => setFilter("groupId", event.target.value)}><option value="ALL">Tất cả nhóm</option>{visibleGroups.map(group => <option key={group.id} value={group.id}>{group.group_name || group.external_group_id} · {group.platform}</option>)}</select></label>
    </div>

    {loading ? <PageLoading label="Đang tổng hợp số liệu..." /> : report && <>
      <p className="report-method-note">Múi giờ {report.timeZone}. Thống kê lượt hỏi chia theo từng giờ trong ngày, đủ 24 giờ. Nếu phản hồi đến trong giờ nghỉ, thời gian tính từ tin đầu đến lúc phản hồi theo thời gian thực. Nếu SLA vẫn chưa được xử lý khi hết giờ nghỉ, khoảng nghỉ được loại khỏi đồng hồ SLA (08:00–12:00, 13:00–17:00, 18:00–23:00, tính mọi ngày). Các tỷ lệ dùng mẫu số là lượt không bị hủy; lượt chưa phản hồi không đạt mốc.</p>

      <section className="report-summary-grid">
        <article className="report-stat-card"><span>Tổng lượt hỏi</span><strong>{report.summary.totalInquiries.toLocaleString("vi-VN")}</strong><small>{report.summary.cancelled} SLA đã hủy</small></article>
        <article className="report-stat-card"><span>Phản hồi bằng tin chữ</span><strong>{report.summary.answeredByText.toLocaleString("vi-VN")}</strong><small>Không tính reaction là phản hồi chữ</small></article>
        <article className="report-stat-card"><span>Phản hồi tính cả reaction</span><strong>{report.summary.answeredIncludingReactions.toLocaleString("vi-VN")}</strong><small>{Math.max(0, report.summary.answeredIncludingReactions - report.summary.answeredByText)} lượt reaction là phản hồi đầu tiên</small></article>
        <article className="report-stat-card"><span>Đang chờ quá 30 phút làm việc</span><strong>{report.summary.waitingOver30IncludingReactions.toLocaleString("vi-VN")}</strong><small>Đồng hồ SLA bỏ qua các khoảng nghỉ</small></article>
        <article className="report-stat-card"><span>Trung vị thời gian SLA · tính reaction</span><strong>{minutes(report.summary.medianResponseSlaMinutesIncludingReactions)}</strong><small>Thời gian thực: {minutes(report.summary.medianWallMinutesIncludingReactions)}</small></article>
      </section>

      <section className="panel report-panel">
        <div className="panel-heading"><div><h2>Tỷ lệ phản hồi theo mốc</h2><p>Mốc tính theo đồng hồ SLA; mẫu số gồm tất cả lượt SLA không bị hủy.</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>Mốc</th><th>Tin chữ · lượt</th><th>Tin chữ · tỷ lệ</th><th>Tính reaction · lượt</th><th>Tính reaction · tỷ lệ</th></tr></thead><tbody>
          {report.summary.thresholds.map(row => <tr key={row.minutes}><td>Trong {row.minutes} phút</td><td>{row.textCount}</td><td>{percent(row.textRate)}</td><td>{row.includingReactionsCount}</td><td>{percent(row.includingReactionsRate)}</td></tr>)}
        </tbody></table></div>
      </section>

      <section className="panel report-panel">
        <div className="panel-heading"><div><h2>Theo giờ nhận tin</h2><p>Mỗi dòng là một giờ; các giờ ngoài khung hỗ trợ vẫn có số liệu.</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>Giờ nhận tin</th><th>Lượt hỏi</th><th>Trả lời chữ</th><th>Tính reaction</th><th>≤3 phút chữ</th><th>≤3 phút reaction</th><th>≤10 phút chữ</th><th>≤10 phút reaction</th><th>Trung vị SLA</th></tr></thead><tbody>
          {report.byHour.map(row => <tr key={row.key}><td>{row.label}</td><td>{row.totalInquiries}</td><td>{row.answeredByText}</td><td>{row.answeredIncludingReactions}</td><td>{percent(thresholdCell(row.thresholds, 3, "textRate"))}</td><td>{percent(thresholdCell(row.thresholds, 3, "includingReactionsRate"))}</td><td>{percent(thresholdCell(row.thresholds, 10, "textRate"))}</td><td>{percent(thresholdCell(row.thresholds, 10, "includingReactionsRate"))}</td><td>{minutes(row.medianResponseSlaMinutesIncludingReactions)}</td></tr>)}
        </tbody></table></div>
      </section>

      <section className="panel report-panel">
        <div className="panel-heading"><div><h2>Theo nhóm</h2><p>Nhóm được xếp theo lượt hỏi trong kỳ lọc.</p></div></div>
        {report.byGroup.length === 0 ? <EmptyState>Chưa có lượt SLA trong khoảng thời gian này.</EmptyState> : <div className="table-wrap"><table><thead><tr><th>Nhóm</th><th>Kênh</th><th>Lượt hỏi</th><th>Hủy</th><th>Trả lời chữ</th><th>Tính reaction</th><th>Đang chờ</th><th>Chờ &gt;30p chữ</th><th>Chờ &gt;30p reaction</th><th>Trung vị SLA · chữ</th><th>Trung vị SLA · reaction</th><th>≤3p chữ</th><th>≤3p reaction</th><th>≤10p chữ</th><th>≤10p reaction</th></tr></thead><tbody>
          {report.byGroup.map(row => <tr key={row.conversationId}><td>{row.groupName}</td><td>{row.platform}</td><td>{row.totalInquiries}</td><td>{row.cancelled}</td><td>{row.answeredByText}</td><td>{row.answeredIncludingReactions}</td><td>{row.waiting}</td><td>{row.waitingOver30TextOnly}</td><td>{row.waitingOver30IncludingReactions}</td><td>{minutes(row.medianResponseSlaMinutesTextOnly)}</td><td>{minutes(row.medianResponseSlaMinutesIncludingReactions)}</td><td>{percent(thresholdCell(row.thresholds, 3, "textRate"))}</td><td>{percent(thresholdCell(row.thresholds, 3, "includingReactionsRate"))}</td><td>{percent(thresholdCell(row.thresholds, 10, "textRate"))}</td><td>{percent(thresholdCell(row.thresholds, 10, "includingReactionsRate"))}</td></tr>)}
        </tbody></table></div>}
      </section>

      <section className="panel report-panel">
        <div className="panel-heading"><div><h2>Lượt hỏi theo ngày</h2><p>Chỉ số theo ngày địa phương, bao gồm lượt ngoài khung.</p></div></div>
        {report.byDay.length === 0 ? <EmptyState>Chưa có dữ liệu trong kỳ này.</EmptyState> : <><div className="bar-chart" aria-label="Số lượt hỏi mỗi ngày">{report.byDay.map(row => <div className="bar-column" key={row.day} title={`${row.totalInquiries} lượt hỏi`}><span className="bar-value">{row.totalInquiries}</span><div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max(row.totalInquiries ? 4 : 0, Number(row.totalInquiries) / maxOpened * 100)}%` }} /></div><small>{new Date(`${row.day}T12:00:00+07:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", timeZone: TIME_ZONE })}</small></div>)}</div><div className="table-wrap"><table><thead><tr><th>Ngày</th><th>Lượt hỏi</th><th>Hủy</th><th>Trả lời chữ</th><th>Tính reaction</th><th>Đang chờ</th><th>Trung vị SLA · reaction</th><th>Trung vị thực tế · reaction</th></tr></thead><tbody>{report.byDay.map(row => <tr key={row.day}><td>{row.day}</td><td>{row.totalInquiries}</td><td>{row.cancelled}</td><td>{row.answeredByText}</td><td>{row.answeredIncludingReactions}</td><td>{row.waiting}</td><td>{minutes(row.medianResponseSlaMinutesIncludingReactions)}</td><td>{minutes(row.medianWallMinutesIncludingReactions)}</td></tr>)}</tbody></table></div></>}
      </section>
    </>}
  </div>;
}
