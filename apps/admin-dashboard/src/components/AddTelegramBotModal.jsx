import { useState } from "react";
import { connectionApi } from "../api/connectionApi";

export default function AddTelegramBotModal({ onClose, onCreated }) {
  const [displayName, setDisplayName] = useState("");
  const [botToken, setBotToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const bot = await connectionApi.createTelegramBot({
        displayName: displayName.trim(),
        botToken: botToken.trim()
      });
      setBotToken("");
      await onCreated?.(bot);
    } catch (err) {
      setError(err.response?.data?.message || "Không thể thêm Telegram bot");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <form className="qr-modal" onSubmit={handleSubmit}>
        <h2>Thêm Telegram Bot</h2>
        <p>Nhập token do BotFather cấp. Token được mã hóa trước khi lưu vào database.</p>
        <label style={{ display: "block", marginBottom: 8 }}>Tên hiển thị</label>
        <input
          type="text"
          value={displayName}
          onChange={event => setDisplayName(event.target.value)}
          placeholder="Ví dụ: Bot chăm sóc khách hàng"
          minLength={3}
          maxLength={150}
          required
          style={{ width: "100%", padding: 12, marginBottom: 16, border: "1px solid #e2e8f0", borderRadius: 6, boxSizing: "border-box" }}
        />
        <label style={{ display: "block", marginBottom: 8 }}>Bot token</label>
        <input
          type="password"
          value={botToken}
          onChange={event => setBotToken(event.target.value)}
          placeholder="123456789:..."
          autoComplete="new-password"
          spellCheck="false"
          required
          style={{ width: "100%", padding: 12, marginBottom: 16, border: "1px solid #e2e8f0", borderRadius: 6, boxSizing: "border-box" }}
        />
        {error && <p role="alert" style={{ color: "#dc2626", marginBottom: 12, fontSize: 14 }}>{error}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button type="button" className="btn-action btn-secondary" onClick={onClose} disabled={loading}>Hủy</button>
          <button type="submit" className="btn-action btn-primary" disabled={loading || displayName.trim().length < 3 || !botToken.trim()}>
            {loading ? "Đang xác thực và thêm..." : "Thêm bot"}
          </button>
        </div>
      </form>
    </div>
  );
}
