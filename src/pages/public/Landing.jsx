// src/pages/public/Landing.jsx
import Login from "./Login";

export default function Landing() {
  const features = [
    {
      title: "Membership control",
      text: "Track members, active subscriptions, and see who is active or expired in seconds.",
      color: "#ff9a5c",
      path: "M12 4a8 8 0 1 0 0 16a8 8 0 0 0 0-16Zm-2.5 8.2l1.7 1.7l4.3-4.3",
    },
    {
      title: "Recurring payments",
      text: "Collect subscriptions automatically with M-Pesa and reconcile payments with clean reporting.",
      color: "#67b7ff",
      path: "M4 12h16M6 8h12M7 16h10",
    },
    {
      title: "Automated reminders",
      text: "Notify members when subscriptions are expiring or inactive to drive renewals.",
      color: "#f1c232",
      path: "M12 4a6 6 0 0 0-6 6v4l-2 2h16l-2-2v-4a6 6 0 0 0-6-6",
    },
    {
      title: "Usage‑based pricing",
      text: "Only pay for members with active subscriptions for maximum cost control.",
      color: "#4ade80",
      path: "M6 7h12v10H6zM9 10h6M9 14h4",
    },
    {
      title: "Market your gym",
      text: "Get a public online presence and promote your gym to new members.",
      color: "#a78bfa",
      path: "M4 14l8-8l8 8M6 12v6h12v-6",
    },
    {
      title: "Store + upsells",
      text: "Sell supplements, training sessions, and more to boost revenue.",
      color: "#fb7185",
      path: "M6 6h12l-1 6H7L6 6Zm2 10a1 1 0 1 0 0 2a1 1 0 0 0 0-2Zm8 0a1 1 0 1 0 0 2a1 1 0 0 0 0-2Z",
    },
    {
      title: "Newsletter sendouts",
      text: "Reach all members with updates, promos, and announcements.",
      color: "#60a5fa",
      path: "M4 8h16v8H4zM4 8l8 5l8-5",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 15% -10%, rgba(255, 234, 204, 0.9), rgba(255,255,255,0))," +
          "radial-gradient(900px 500px at 90% 0%, rgba(209, 242, 255, 0.7), rgba(255,255,255,0))," +
          "linear-gradient(180deg, #fffaf4 0%, #f7f9fc 40%, #ffffff 100%)",
        color: "#1c1813",
      }}
    >
      <div
        style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px 10px" }}
      >
        <header
          className="landing-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 28,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background:
                  "linear-gradient(135deg, rgba(255,120,66,0.95), rgba(255,204,99,0.95))",
                display: "grid",
                placeItems: "center",
                color: "#1c1813",
                fontWeight: 900,
              }}
            >
              G
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: "-0.02em",
              }}
            >
              Onlinegym
            </div>
          </div>
          <div
            className="landing-cta"
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            <a
              href="/login"
              className="btn-primary"
              style={{
                textDecoration: "none",
                borderRadius: 999,
                padding: "8px 14px",
              }}
            >
              Gym login
            </a>
            <a
              href="/create"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid rgba(28,24,19,.15)",
                background: "#fff7ed",
                fontWeight: 700,
                textDecoration: "none",
                color: "#1c1813",
              }}
            >
              Create gym
            </a>
          </div>
        </header>

        <section
          className="landing-hero"
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 18,
            alignItems: "center",
          }}
        >
          <div
            className="landing-hero-copy"
            style={{ display: "grid", gap: 12 }}
          >
            <div
              style={{
                fontSize: "clamp(28px, 5vw, 48px)",
                fontWeight: 900,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
              }}
            >
              Run your gym like a business — not a spreadsheet.
            </div>
            <div style={{ fontSize: 16, opacity: 0.8, lineHeight: 1.6 }}>
              Onlinegym gives you a full online system for member control,
              active subscriptions, recurring M‑Pesa payments, and automated
              reminders that keep revenue consistent.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "#fff",
                  border: "1px solid rgba(28,24,19,.12)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Active member tracking
              </div>
              <div
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "#fff",
                  border: "1px solid rgba(28,24,19,.12)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Automated renewals
              </div>
              <div
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "#fff",
                  border: "1px solid rgba(28,24,19,.12)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Usage‑based pricing
              </div>
            </div>
          </div>

          <div
            className="landing-hero-preview"
            style={{
              borderRadius: 18,
              padding: 16,
              background: "linear-gradient(180deg, #ffffff 0%, #fff4e7 100%)",
              border: "1px solid rgba(28,24,19,.08)",
              boxShadow: "0 20px 50px rgba(30,30,50,0.08)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>
              Live Dashboard Preview
            </div>
            <svg
              viewBox="0 0 520 260"
              width="100%"
              height="260"
              style={{ display: "block", width: "100%", height: "auto" }}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <linearGradient id="card" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#ffe0c7" />
                  <stop offset="100%" stopColor="#eaf4ff" />
                </linearGradient>
                <linearGradient id="bar" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" />
                  <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>
                <linearGradient id="line" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#fb7185" />
                </linearGradient>
              </defs>
              <rect
                x="0"
                y="0"
                width="520"
                height="260"
                rx="18"
                fill="url(#card)"
              />
              <rect x="20" y="20" width="180" height="90" rx="10" fill="#fff" />
              <rect
                x="220"
                y="20"
                width="280"
                height="90"
                rx="10"
                fill="#fff"
              />
              <rect
                x="20"
                y="130"
                width="300"
                height="100"
                rx="10"
                fill="#fff"
              />
              <rect
                x="340"
                y="130"
                width="160"
                height="100"
                rx="10"
                fill="#fff"
              />
              <circle cx="58" cy="65" r="22" fill="#ff9a5c" />
              <text x="90" y="46" fontSize="11" fill="#6b7280">
                Active members
              </text>
              <text x="90" y="72" fontSize="20" fontWeight="700" fill="#111827">
                1,248
              </text>
              <text x="240" y="46" fontSize="11" fill="#6b7280">
                Monthly revenue
              </text>
              <text
                x="240"
                y="72"
                fontSize="20"
                fontWeight="700"
                fill="#111827"
              >
                KES 842,000
              </text>
              <rect
                x="30"
                y="150"
                width="260"
                height="60"
                rx="8"
                fill="#f8fafc"
              />
              <text x="42" y="152" fontSize="11" fill="#6b7280">
                Subscriptions by plan
              </text>
              <rect
                x="42"
                y="194"
                width="40"
                height="16"
                rx="4"
                fill="url(#bar)"
              />
              <rect
                x="88"
                y="188"
                width="40"
                height="22"
                rx="4"
                fill="url(#bar)"
              />
              <rect
                x="134"
                y="182"
                width="40"
                height="28"
                rx="4"
                fill="url(#bar)"
              />
              <rect
                x="180"
                y="198"
                width="40"
                height="12"
                rx="4"
                fill="url(#bar)"
              />
              <rect
                x="226"
                y="192"
                width="40"
                height="18"
                rx="4"
                fill="url(#bar)"
              />
              <rect
                x="350"
                y="150"
                width="140"
                height="70"
                rx="8"
                fill="#f8fafc"
              />
              <text x="362" y="152" fontSize="11" fill="#6b7280">
                Renewals
              </text>
              <path
                d="M362 198 C378 186, 394 190, 410 178 S442 172, 478 160"
                fill="none"
                stroke="url(#line)"
                strokeWidth="3"
              />
              <text x="410" y="206" fontSize="10" fill="#6b7280">
                +12% this week
              </text>
            </svg>
          </div>
        </section>

        <section
          className="landing-photos"
          style={{
            marginTop: 22,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {[
            {
              src: "https://images.unsplash.com/photo-1554284126-aa88f22d8b74?auto=format&fit=crop&w=900&q=80",
              alt: "Gym equipment and weights",
            },
            {
              src: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80",
              alt: "Gym interior with machines",
            },
            {
              src: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80",
              alt: "Trainer working with a client",
            },
          ].map((img, idx) => (
            <div
              key={img.src}
              className={idx > 0 ? "landing-photo-extra" : undefined}
              style={{
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid rgba(28,24,19,.08)",
                background: "#fff",
              }}
            >
              <img
                src={img.src}
                alt={img.alt}
                style={{ width: "100%", height: 160, objectFit: "cover" }}
                loading="lazy"
              />
            </div>
          ))}
        </section>

        <section style={{ marginTop: 28 }}>
          <div
            className="landing-feature-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14,
            }}
          >
            {features.map((f, i) => (
              <div
                key={f.title}
                style={{
                  padding: 14,
                  border: "1px solid rgba(28,24,19,.08)",
                  borderRadius: 14,
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 10,
                      background: `${f.color}22`,
                      display: "grid",
                      placeItems: "center",
                      border: `1px solid ${f.color}55`,
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke={f.color}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={f.path} />
                    </svg>
                  </div>
                  <div style={{ fontWeight: 800 }}>{f.title}</div>
                </div>
                <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>
                  {f.text}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          className="landing-split"
          style={{
            marginTop: 28,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <div
            className="card"
            style={{
              padding: 18,
              borderRadius: 16,
              background: "#fff",
              border: "1px solid rgba(28,24,19,.08)",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 8 }}>
              Why gyms choose Onlinegym
            </div>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>
              Replace scattered spreadsheets with a clean system built for gym
              operations. Get visibility, get paid, and keep members active.
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 13,
                opacity: 0.85,
              }}
            >
              <li>Know exactly who is active and who needs a follow‑up</li>
              <li>Get paid on time with automated recurring payments</li>
              <li>Save hours every week with reminders and reporting</li>
              <li>Grow revenue with online sales, upsells, and newsletters</li>
              <li>Only pay for members with active subscriptions</li>
            </ul>
            <div
              style={{
                marginTop: 14,
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid rgba(28,24,19,.08)",
              }}
            >
              <img
                src="https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?auto=format&fit=crop&w=900&q=80"
                alt="Members training in a modern gym"
                style={{ width: "100%", height: 160, objectFit: "cover" }}
                loading="lazy"
              />
            </div>
          </div>
          <div
            className="card"
            style={{
              padding: 16,
              borderRadius: 16,
              background: "linear-gradient(180deg, #ffffff 0%, #f3f8ff 100%)",
              border: "1px solid rgba(28,24,19,.08)",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Login</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
              Already have a gym? Log in below.
            </div>
            <div style={{ maxWidth: 420 }}>
              <Login embedded />
            </div>
          </div>
        </section>

        <footer
          className="landing-footer"
          style={{
            marginTop: 32,
            padding: "18px 4px 10px",
            borderTop: "1px solid rgba(28,24,19,.08)",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            fontSize: 12,
            opacity: 0.7,
          }}
        >
          <div>© {new Date().getFullYear()} Onlinegym</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <a href="/terms" style={{ color: "inherit" }}>
              Terms of Service
            </a>
            <span aria-hidden="true">•</span>
            <a href="/privacy" style={{ color: "inherit" }}>
              Privacy Policy
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
