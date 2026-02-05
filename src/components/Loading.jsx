export default function Loading({
  label = "Loading",
  size = 28,
  minHeight = 160,
  compact = false,
  fullScreen = true,
  showLabel = true,
  fullWidth = true,
}) {
  const ring = Math.max(16, Number(size) || 28);
  const border = Math.max(2, Math.round(ring / 8));
  const containerStyle = {
    padding: compact ? 8 : 24,
    minHeight: compact ? 0 : fullScreen ? "100vh" : minHeight,
    width: fullWidth ? "100%" : "auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    fontFamily: "system-ui",
    color: "rgba(28,24,19,.75)",
  };
  const spinnerStyle = {
    width: ring,
    height: ring,
    borderRadius: "50%",
    border: `${border}px solid rgba(28,24,19,.18)`,
    borderTopColor: "rgba(28,24,19,.7)",
    animation: "gymonline-spin 0.9s linear infinite",
  };
  const labelStyle = {
    fontSize: 12,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  };
  return (
    <div style={containerStyle} role="status" aria-live="polite">
      <div style={spinnerStyle} aria-hidden="true" />
      {showLabel ? <div style={labelStyle}>{label}</div> : null}
      <style>{`
        @keyframes gymonline-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
