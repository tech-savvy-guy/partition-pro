import { AuthUser } from "@/core/auth/auth.types";

interface AccountPanelProps {
  user: AuthUser;
  roleLabel: string;
  onClose: () => void;
  onLogout: () => void;
  onViewAccount: () => void;
}

const getInitials = (name?: string, email?: string) => {
  if (name) {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }
  return email?.[0]?.toUpperCase() ?? "?";
};

  const buttonStyle: React.CSSProperties = {
    color: "red",
    fontSize: "13px"
  };

export default function AccountPanel({
  user,
  roleLabel,
  onLogout,
  onViewAccount,
}: AccountPanelProps) {
  return (
    <div className="account-panel">
      {/* Header row */}
      <div className="account-panel__top">
        <span className="account-panel__role">{roleLabel}</span>
        <button className="account-panel__signout" onClick={onLogout}>
          Sign out
        </button>
      </div>

      {/* User info */}
      <div className="account-panel__user">
        <div className="account-panel__avatar">
          {getInitials(user.name, user.email)}
        </div>

        <div className="account-panel__details">
          <div className="account-panel__name">{user.name}</div>
          <div className="account-panel__email">{user.email}</div>
          <button style={buttonStyle} onClick={onViewAccount}>
            View account
          </button>
        </div>
      </div>
    </div>
  );
}
