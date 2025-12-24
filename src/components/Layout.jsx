// Layout.jsx (works with the sidebar Navbar above)
import Navbar from "./Navbar";

export default function Layout({ children, mode }) {
  return (
    <div
      style={{ fontFamily: "system-ui", display: "flex", minHeight: "100vh" }}
    >
      <Navbar mode={mode} />
      <main style={{ flex: 1, padding: 20, background: "#fafafa" }}>
        <div
          style={{
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 16,
            minHeight: "calc(100vh - 40px)",
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
