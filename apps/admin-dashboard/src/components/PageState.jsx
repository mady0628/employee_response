export function PageError({ message, onRetry }) {
  return (
    <div className="page-state page-state-error" role="alert">
      <span>{message || "Không tải được dữ liệu."}</span>
      {onRetry && <button className="btn-action btn-secondary" onClick={onRetry}>Thử lại</button>}
    </div>
  );
}

export function PageLoading({ label = "Đang tải dữ liệu..." }) {
  return <div className="page-state">{label}</div>;
}

export function EmptyState({ children }) {
  return <div className="page-state">{children}</div>;
}

export function errorMessage(error, fallback = "Có lỗi xảy ra.") {
  return error?.response?.data?.message || error?.message || fallback;
}
