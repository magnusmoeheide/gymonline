import { useAuth } from "../../context/AuthContext";

export default function Profile() {
  const { user, userDoc } = useAuth();
  const name =
    userDoc?.name || userDoc?.fullName || userDoc?.displayName || user?.email;
  const phone = userDoc?.phoneE164 || userDoc?.phone || user?.phoneNumber;
  const role = userDoc?.role;

  return (
    <div>
      <h2>Profile</h2>
      <div>
        Email: <b>{user?.email || "-"}</b>
      </div>
      <div>
        Name: <b>{name || "-"}</b>
      </div>
      <div>
        Phone: <b>{phone || "-"}</b>
      </div>
      <div>
        Role: <b>{role || "-"}</b>
      </div>
    </div>
  );
}
