export default function FeatureUnavailable({
  title = "Feature unavailable",
  message = "This area is temporarily unavailable.",
  actionHref = "/",
  actionLabel = "Back to home",
  compact = false,
}) {
  return (
    <div
      style={{
        minHeight: compact ? "auto" : "100vh",
        display: "grid",
        placeItems: "center",
        padding: compact ? 0 : 24,
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 520,
          padding: 22,
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            width: "fit-content",
            padding: "6px 10px",
            borderRadius: 999,
            background: "#fff7ed",
            border: "1px solid rgba(28,24,19,.12)",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          Unavailable
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
          {title}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.82 }}>
          {message}
        </div>
        {actionHref ? (
          <div style={{ marginTop: 4 }}>
            <a
              href={actionHref}
              className="btn-primary"
              style={{ textDecoration: "none" }}
            >
              {actionLabel}
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
