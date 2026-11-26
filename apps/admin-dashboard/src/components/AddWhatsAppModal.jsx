import { useState } from "react";
import { connectionApi } from "../api/connectionApi";

export default function AddWhatsAppModal({
  onClose,
  onCreated
}) {
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const connection =
        await connectionApi.createWhatsApp(
          displayName.trim()
        );

      onCreated(connection);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Không thể tạo WhatsApp connection"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <form
        className="qr-modal"
        onSubmit={handleSubmit}
      >
        <h2>Thêm tài khoản WhatsApp</h2>

        <p>
          Đặt tên để phân biệt tài khoản.
          Bạn sẽ quét QR ở bước tiếp theo.
        </p>

        <input
          type="text"
          placeholder="Ví dụ: WhatsApp Sales Miền Bắc"
          value={displayName}
          maxLength={150}
          onChange={event =>
            setDisplayName(event.target.value)
          }
          required
          minLength={3}
          style={{
            width: "100%",
            padding: "12px",
            marginBottom: "16px",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            boxSizing: "border-box"
          }}
        />

        {error && (
          <p role="alert" style={{ color: "#dc2626", marginBottom: "12px", fontSize: "14px" }}>
            {error}
          </p>
        )}

        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "12px"
        }}>
          <button
            type="button"
            className="btn-action btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Hủy
          </button>

          <button
            type="submit"
            className="btn-action btn-primary"
            disabled={
              loading ||
              displayName.trim().length < 3
            }
          >
            {loading ? "Đang tạo..." : "Tạo kết nối"}
          </button>
        </div>
      </form>
    </div>
  );
}
