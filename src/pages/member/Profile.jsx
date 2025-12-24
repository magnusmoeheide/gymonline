import { useAuth } from "../../context/AuthContext";

export default function Profile() {
  const { user, userDoc } = useAuth();

  return (
    <div>
      <h2>Profile</h2>
      <div>
        Email: <b>{user?.email || "-"}</b>
      </div>
      <div>
        Name: <b>{userDoc?.name || "-"}</b>
      </div>
      <div>
        Phone: <b>{userDoc?.phoneE164 || "-"}</b>
      </div>
      <div>
        Role: <b>{userDoc?.role || "-"}</b>
      </div>
    </div>
  );
}
