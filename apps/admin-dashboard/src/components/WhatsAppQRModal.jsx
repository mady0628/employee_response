import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { connectionApi } from "../api/connectionApi";

export default function WhatsAppQRModal({
  connectionId,
  connectionName,
  onClose,
  onConnected
}) {
  const [runtime, setRuntime] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!connectionId) return;

    let active = true;

    async function refresh() {
      try {
        const data = await connectionApi.getRuntime(connectionId);
        if (!active) return;
        setRuntime(data);
        if (data.status === "CONNECTED") {
          onConnected?.();
        }
      } catch (err) {
        if (active) {
          setError("Không lấy được trạng thái WhatsApp");
        }
      }
    }

    refresh();
    const timer = setInterval(refresh, 2000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [connectionId, onConnected]);

  if (!connectionId) return null;

  return (
    <div className="modal-overlay">
      <div className="qr-modal">
        <h2>Kết nối WhatsApp</h2>
        {connectionName && <p className="qr-modal-conn-name">{connectionName}</p>}
        <p className="qr-instructions">
          Mở WhatsApp trên điện thoại → <strong>Thiết bị đã liên kết</strong> (Linked Devices) → <strong>Liên kết thiết bị</strong> (Link a Device).
        </p>

        {error && (
          <p role="alert" style={{ color: "#e53e3e", margin: "10px 0" }}>
            {error}
          </p>
        )}

        {runtime?.status === "QR_PENDING" && runtime.qr && (
          <div className="qr-code">
            <QRCodeSVG value={runtime.qr} size={240} level="M" />
          </div>
        )}

        {runtime?.status === "CONNECTING" && (
          <div className="qr-status-msg">
            <div className="spinner" />
            <p>Đang khởi tạo trình duyệt WhatsApp...</p>
          </div>
        )}

        {runtime?.status === "AUTHENTICATED" && (
          <p style={{ color: "#2b6cb0", fontWeight: 600 }}>
            Đã quét mã! Đang hoàn tất đăng nhập...
          </p>
        )}

        {runtime?.status === "CONNECTED" && (
          <div className="qr-status-msg success">
            <p style={{ color: "#22543d", fontWeight: "bold", fontSize: 16 }}>
              ✅ WhatsApp đã kết nối thành công!
            </p>
            {runtime.accountId && (
              <p style={{ fontSize: 13, color: "#4a5568" }}>
                Số tài khoản: {runtime.accountId}
              </p>
            )}
          </div>
        )}

        {runtime?.status === "ERROR" && (
          <p style={{ color: "#e53e3e" }}>
            Không thể kết nối. Vui lòng thử lại.
          </p>
        )}

        <button className="btn-modal-close" onClick={onClose}>
          Đóng
        </button>
      </div>
    </div>
  );
}
