import { useCallback, useEffect, useState } from "react";
import {
  Plus, Smartphone, Send, CircleCheck, CircleAlert, QrCode, Square,
  LogOut, RefreshCw
} from "lucide-react";
import { connectionApi } from "../api/connectionApi";
import WhatsAppQRModal from "../components/WhatsAppQRModal";
import AddWhatsAppModal from "../components/AddWhatsAppModal";
import AddTelegramBotModal from "../components/AddTelegramBotModal";

export default function ConnectionsPage() {
  const [connections, setConnections] = useState([]);
  const [telegramBots, setTelegramBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [error, setError] = useState("");
  const [telegramError, setTelegramError] = useState("");
  const [showAddWhatsApp, setShowAddWhatsApp] = useState(false);
  const [showAddTelegram, setShowAddTelegram] = useState(false);
  const [activeModalConn, setActiveModalConn] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      setConnections((await connectionApi.getAll()) || []);
      setError("");
    } catch {
      setError("Không thể tải danh sách kết nối");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTelegramBots = useCallback(async () => {
    try {
      setTelegramLoading(true);
      setTelegramBots((await connectionApi.getTelegramBots()) || []);
      setTelegramError("");
    } catch (err) {
      setTelegramError(err.response?.data?.message || "Không thể tải danh sách Telegram bot");
    } finally {
      setTelegramLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
    fetchTelegramBots();
  }, [fetchConnections, fetchTelegramBots]);

  async function refreshAll() {
    await Promise.all([fetchConnections(), fetchTelegramBots()]);
  }

  async function checkTelegramBot(id) {
    try {
      setActionLoadingId(`telegram-${id}`);
      await connectionApi.checkTelegramBot(id);
      await fetchTelegramBots();
    } catch (err) {
      setTelegramError(err.response?.data?.message || "Không kiểm tra được Telegram bot");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function configureTelegramBot(id) {
    try {
      setActionLoadingId(`telegram-${id}`);
      await connectionApi.configureTelegramWebhook(id);
      await fetchTelegramBots();
    } catch (err) {
      setTelegramError(err.response?.data?.message || "Không cấu hình được webhook Telegram");
      await fetchTelegramBots();
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleAddWhatsApp() {
    const name = window.prompt("Nhập tên tài khoản WhatsApp mới (ví dụ: WhatsApp Sales 02):");
    if (!name?.trim()) return;
    try {
      setLoading(true);
      const connection = await connectionApi.createWhatsApp(name.trim());
      await fetchConnections();
      if (connection?.id) setActiveModalConn(connection);
    } catch (err) {
      alert("Không thể tạo kết nối WhatsApp: " + err.message);
      setLoading(false);
    }
  }

  async function handleStartSession(connection) {
    try {
      setActionLoadingId(connection.id);
      await connectionApi.start(connection.id);
      setActiveModalConn(connection);
      await fetchConnections();
    } catch (err) {
      alert("Lỗi khởi tạo phiên: " + (err.response?.data?.message || err.message));
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleStopSession(connectionId) {
    if (!window.confirm("Bạn có chắc muốn tạm dừng phiên WhatsApp này không?")) return;
    try {
      setActionLoadingId(connectionId);
      await connectionApi.stop(connectionId);
      await fetchConnections();
    } catch (err) {
      alert("Lỗi dừng phiên: " + (err.response?.data?.message || err.message));
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleLogoutSession(connectionId) {
    if (!window.confirm("Đăng xuất tài khoản WhatsApp này? Bạn sẽ cần quét mã QR lại nếu muốn kết nối số mới.")) return;
    try {
      setActionLoadingId(connectionId);
      await connectionApi.logout(connectionId);
      await fetchConnections();
    } catch (err) {
      alert("Lỗi đăng xuất: " + (err.response?.data?.message || err.message));
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Quản lý kết nối</h1>
          <p>Quản lý Telegram bot, tài khoản WhatsApp và trạng thái giám sát</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn-action btn-secondary" onClick={refreshAll} disabled={loading || telegramLoading}>
            <RefreshCw size={15} className={loading || telegramLoading ? "spinner" : ""} /> Làm mới
          </button>
          <button className="btn-action btn-secondary" onClick={() => setShowAddTelegram(true)}>
            <Plus size={17} /> Thêm Telegram Bot
          </button>
          <button className="btn-add-conn" onClick={() => setShowAddWhatsApp(true)}>
            <Plus size={18} /> Thêm WhatsApp
          </button>
        </div>
      </div>

      {error && <p role="alert" style={{ color: "#e53e3e", background: "#fff5f5", padding: 12, borderRadius: 8 }}>{error}</p>}
      {telegramError && <p role="alert" style={{ color: "#e53e3e", background: "#fff5f5", padding: 12, borderRadius: 8 }}>{telegramError}</p>}
      {loading && connections.length === 0 && <p>Đang tải kết nối WhatsApp...</p>}
      {telegramLoading && telegramBots.length === 0 && <p>Đang tải Telegram bot...</p>}

      <div className="connection-grid">
        {telegramBots.map(bot => {
          const busy = actionLoadingId === `telegram-${bot.id}`;
          const connected = bot.status === "CONNECTED";
          return (
            <div className="connection-card" key={`telegram-${bot.id}`}>
              <div className="connection-card-header">
                <div className="connection-icon"><Send /></div>
                <div className={connected ? "status connected" : "status disconnected"}>
                  {connected ? <CircleCheck size={15} /> : <CircleAlert size={15} />}
                  {bot.status || "PENDING"}
                </div>
              </div>
              <h3>{bot.display_name || bot.name}</h3>
              <p>{bot.bot_username ? `@${bot.bot_username}` : `Telegram Bot ID ${bot.bot_id}`}</p>
              {bot.last_error && <p role="alert" style={{ color: "#c53030", fontSize: 12 }}>{bot.last_error}</p>}
              <div className="connection-actions">
                <button className="btn-action btn-secondary" onClick={() => checkTelegramBot(bot.id)} disabled={busy}>
                  <RefreshCw size={14} className={busy ? "spinner" : ""} /> Kiểm tra
                </button>
                <button className="btn-action btn-primary" onClick={() => configureTelegramBot(bot.id)} disabled={busy}>
                  <Send size={14} /> Cấu hình webhook
                </button>
              </div>
              <div className="connection-footer"><span>{bot.group_count || 0} groups đang giám sát</span></div>
            </div>
          );
        })}

        {connections.filter(connection => connection.platform === "WHATSAPP").map(connection => {
          const connected = connection.connection_status === "CONNECTED";
          const busy = actionLoadingId === connection.id;
          return (
            <div className="connection-card" key={connection.id}>
              <div className="connection-card-header">
                <div className="connection-icon"><Smartphone /></div>
                <div className={connected ? "status connected" : "status disconnected"}>
                  {connected ? <CircleCheck size={15} /> : <CircleAlert size={15} />}
                  {connection.connection_status}
                </div>
              </div>
              <h3>{connection.display_name || connection.name || "Chưa đặt tên"}</h3>
              <p>WHATSAPP • {connection.is_enabled ? "Đang bật" : "Tắt"}</p>
              {connection.connected_account_id && <p style={{ fontSize: 12, color: "#4a5568", marginTop: 4 }}>ID: {connection.connected_account_id}</p>}
              <div className="connection-actions">
                {!connected ? (
                  <button className="btn-action btn-primary" onClick={() => handleStartSession(connection)} disabled={busy}>
                    <QrCode size={15} /> {connection.connection_status === "QR_PENDING" ? "Xem mã QR" : "Kết nối / Quét QR"}
                  </button>
                ) : (
                  <button className="btn-action btn-secondary" onClick={() => handleStopSession(connection.id)} disabled={busy}>
                    <Square size={14} /> Dừng
                  </button>
                )}
                <button className="btn-action btn-danger" onClick={() => handleLogoutSession(connection.id)} disabled={busy}>
                  <LogOut size={14} /> Đăng xuất / Đổi số
                </button>
              </div>
              <div className="connection-footer"><span>{connection.group_count || 0} groups đang giám sát</span></div>
            </div>
          );
        })}
      </div>

      {!loading && !telegramLoading && telegramBots.length === 0 && !connections.some(connection => connection.platform === "WHATSAPP") && (
        <p>Chưa có kết nối nào. Hãy thêm Telegram Bot hoặc WhatsApp để bắt đầu.</p>
      )}

      <WhatsAppQRModal
        connectionId={activeModalConn?.id}
        connectionName={activeModalConn?.display_name || activeModalConn?.name}
        onClose={() => setActiveModalConn(null)}
        onConnected={fetchConnections}
      />

      {showAddWhatsApp && (
        <AddWhatsAppModal
          onClose={() => setShowAddWhatsApp(false)}
          onCreated={async connection => {
            setShowAddWhatsApp(false);
            setConnections((await connectionApi.getAll()) || []);
            try {
              await connectionApi.start(connection.id);
              setActiveModalConn(connection);
            } catch {
              alert("Đã tạo connection nhưng chưa khởi động được WhatsApp. Bạn có thể thử kết nối lại từ danh sách.");
            }
          }}
        />
      )}

      {showAddTelegram && (
        <AddTelegramBotModal
          onClose={() => setShowAddTelegram(false)}
          onCreated={async () => {
            setShowAddTelegram(false);
            await fetchConnections();
            await fetchTelegramBots();
          }}
        />
      )}
    </div>
  );
}
