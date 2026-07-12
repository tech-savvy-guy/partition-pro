import * as React from "react";
import {
  Header,
  HeaderContainer,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
  HeaderMenuButton,
} from "@bain/design-system";
import { Notification } from "@carbon/icons-react";
import BainPartitionProIcon from "@/components/icons/BainPartitionPro";
import HeaderNav from "@/components/header/HeaderNav";
import "./header.css";
import { AuthUser } from "@/core/auth/auth.types";
import AccountPanel from "./AccountPanel";

interface AppHeaderProps {
  navExpanded: boolean;
  onNavToggle: () => void;
  onNavHoverStart: () => void;
  onNavHoverEnd: () => void;
  user: AuthUser | null;
  onLogout: () => Promise<void>;
  onProfile: () => void;
}

// Helpers
const getInitials = (user?: AuthUser | null) => {
  if (user?.name) {
    const parts = user.name.split(" ");
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : parts[0][0].toUpperCase();
  }
  return user?.email?.[0]?.toUpperCase() ?? "?";
};

export default function AppHeader({
  navExpanded,
  onNavToggle,
  onNavHoverStart,
  onNavHoverEnd,
  onLogout,
  onProfile,
  user,
}: AppHeaderProps) {
  // Close dropdown on outside click
  const [open, setOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <HeaderContainer
      render={() => (
        <Header aria-label="PartitionPro">
          {/* Left: hamburger + brand */}
          <HeaderMenuButton
            aria-label={navExpanded ? "Close navigation" : "Open navigation"}
            onClick={onNavToggle}
            onMouseEnter={onNavHoverStart}
            onMouseLeave={onNavHoverEnd}
            className="!flex !items-center !justify-center"
          />

          <div className="flex items-center">
            <HeaderName href="#" prefix="" aria-label="Bain Partition Pro">
              <div className="flex items-center gap-2">
                <BainPartitionProIcon width={25} height={25} />
                <span className="leading-none font-semibold">PartitionPro</span>
              </div>
            </HeaderName>
            <span className="bpp-header-divider" />
          </div>

          {/* Center nav */}
          <div className="bpp-header-center hidden md:flex">
            <HeaderNav />
          </div>

          {/* Right: notifications + account */}
          <HeaderGlobalBar>
            {/* Notification bell */}
            <HeaderGlobalAction aria-label="Notifications">
              <Notification />
            </HeaderGlobalAction>

            {/* Account menu */}
            <div className="relative" ref={panelRef}>
              <HeaderGlobalAction
                aria-label="Account"
                onClick={() => setOpen((v) => !v)}
                className="account-trigger"
              >
                <div className="account-trigger__avatar">
                  {getInitials(user)}
                </div>
              </HeaderGlobalAction>

              {open && user && (
                <AccountPanel
                  user={user}
                  roleLabel={user.role ?? "User"}
                  onClose={() => setOpen(false)}
                  onLogout={onLogout}
                  onViewAccount={onProfile}
                />
              )}
            </div>
          </HeaderGlobalBar>
        </Header>
      )}
    />
  );
}
