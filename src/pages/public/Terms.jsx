export default function Terms() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f8fb",
        padding: "40px 16px",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 16,
          padding: "28px 24px",
          border: "1px solid rgba(28,24,19,.08)",
          boxShadow: "0 10px 28px rgba(20,20,40,0.06)",
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
              color: "#0f766e",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            <span aria-hidden="true">←</span>
            Go back
          </a>
        </div>

        <h1 style={{ marginTop: 0 }}>Terms of Service</h1>
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 18 }}>
          Last updated: {new Date().toLocaleDateString()}
        </div>

        <p>
          These Terms of Service (“Terms”) govern your use of Onlinegym (the
          “Service”). The Service is owned and operated by BOMH Ltd, a Kenyan
          company (“BOMH”, “we”, “us”).
        </p>

        <h3>1. Eligibility and accounts</h3>
        <p>
          You must be at least 18 years old and have authority to bind your gym
          or organization. You are responsible for maintaining the security of
          your account credentials and for all activities that occur under your
          account.
        </p>

        <h3>2. The Service</h3>
        <p>
          Onlinegym provides software tools to manage gym memberships,
          subscriptions, communications, and related operations. We may modify,
          improve, or discontinue parts of the Service at any time.
        </p>

        <h3>3. Subscriptions and billing</h3>
        <p>
          Fees, payment terms, and usage-based charges (such as SMS or email
          rates) are provided at checkout or within your admin settings. You are
          responsible for all taxes and fees applicable to your use of the
          Service.
        </p>

        <h3>4. Acceptable use</h3>
        <p>
          You agree not to misuse the Service. This includes sending unlawful,
          abusive, or unsolicited messages, attempting to access data you do not
          own, or interfering with the security or availability of the Service.
        </p>

        <h3>5. Your content and data</h3>
        <p>
          You retain ownership of your data. By using the Service, you grant
          BOMH permission to process your data solely to provide and improve the
          Service. You are responsible for obtaining any required consents from
          your members.
        </p>

        <h3>6. Intellectual property</h3>
        <p>
          The Service, including its design and software, is owned by BOMH or
          its licensors and is protected by applicable laws. You receive a
          limited, non-exclusive, non-transferable right to use the Service
          during your subscription.
        </p>

        <h3>7. Availability</h3>
        <p>
          We aim to keep the Service available, but we do not guarantee
          uninterrupted access. Maintenance, upgrades, or third-party outages
          may cause downtime.
        </p>

        <h3>8. Termination</h3>
        <p>
          You may stop using the Service at any time. We may suspend or
          terminate your access if you violate these Terms or if required by
          law. Upon termination, your access to the Service will end, and data
          may be deleted according to our retention practices.
        </p>

        <h3>9. Disclaimers</h3>
        <p>
          The Service is provided “as is” and “as available”. To the maximum
          extent permitted by law, BOMH disclaims all warranties, express or
          implied, including warranties of merchantability, fitness for a
          particular purpose, and non-infringement.
        </p>

        <h3>10. Limitation of liability</h3>
        <p>
          To the maximum extent permitted by law, BOMH will not be liable for
          indirect, incidental, special, or consequential damages, or for any
          loss of profits, revenue, or data arising from your use of the
          Service.
        </p>

        <h3>11. Indemnity</h3>
        <p>
          You agree to indemnify and hold harmless BOMH from any claims,
          liabilities, and expenses arising from your use of the Service or
          violation of these Terms.
        </p>

        <h3>12. Governing law</h3>
        <p>
          These Terms are governed by the laws of Kenya. Any disputes will be
          resolved in the courts of Kenya.
        </p>

        <h3>13. Contact</h3>
        <p>
          For questions about these Terms, contact us at mail@onlinegym.co.
        </p>
      </div>
    </div>
  );
}
