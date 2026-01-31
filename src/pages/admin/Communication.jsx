// src/pages/admin/Communication.jsx
import { useState } from "react";

export default function Communication() {
  // templates (kept local for now, same placeholders as before)
  const [expiring7, setExpiring7] = useState(
    "Hi {{name}}, your membership expires on {{date}}. Renew to stay active."
  );
  const [expiring1, setExpiring1] = useState(
    "Reminder: membership expires tomorrow ({{date}})."
  );
  const [expired, setExpired] = useState(
    "Your membership expired on {{date}}. Renew anytime."
  );

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <h2>Communication</h2>

      <div style={{ opacity: 0.8 }}>
        Messaging setup is coming soon. For now, edit your template messages
        below.
      </div>

      <div style={{ display: "grid", gap: 10, maxWidth: 820 }}>
        <label>
          Expiring 7 days
          <textarea
            rows={2}
            value={expiring7}
            onChange={(e) => setExpiring7(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          Expiring 1 day
          <textarea
            rows={2}
            value={expiring1}
            onChange={(e) => setExpiring1(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          Expired
          <textarea
            rows={2}
            value={expired}
            onChange={(e) => setExpired(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
      </div>
    </div>
  );
}
