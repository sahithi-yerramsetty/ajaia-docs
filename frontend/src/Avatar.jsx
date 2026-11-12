import { avatarColor, initials } from "./utils.js";

export default function Avatar({ user, size = 28 }) {
  if (!user) return null;
  return (
    <span className="avatar" title={`${user.name} (${user.email})`}
      style={{ background: avatarColor(user.id), width: size, height: size, fontSize: size * 0.45 }}>
      {initials(user.name)}
    </span>
  );
}
