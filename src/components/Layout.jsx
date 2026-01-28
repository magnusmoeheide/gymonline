// src/components/Layout.jsx (replace)
import Navbar from "./Navbar";

export default function Layout({ children, mode }) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
      }}
    >
      <Navbar mode={mode} />

      <main
        style={{
          flex: 1,
          padding: 28,
        }}
      >
        {children}
      </main>
    </div>
  );
}
