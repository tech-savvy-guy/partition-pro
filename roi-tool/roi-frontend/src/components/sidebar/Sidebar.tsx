import React from "react";
import { SideNav, SideNavItems, SideNavDivider } from "@bain/design-system";
import { useLocation, useNavigate } from "react-router-dom";
import SidebarItem from "@/components/sidebar/SidebarItem";
import {
  HomeIcon,
  FolderIcon,
  SettingsIcon,
  ArchiveIcon,
  KnowledgeCenterIcon,
  InformationIcon,
} from "@/components/icons";
import "@/components/sidebar/Sidebar.css";
import { canGlobal, Permission } from "@/core/rbac";
import { useAuth } from "@/core/auth/authContext";

type NavItem = {
  label: string;
  path: string;
  icon: React.ComponentType<any>;
  exact?: boolean;
  requiredPermission?: Permission;
};

const NAV: readonly NavItem[] = [
  { label: "Home", path: "/dashboard", icon: HomeIcon, exact: true },
  { label: "Case Management", path: "/cases", icon: FolderIcon },
  { label: "Archive", path: "/archive", icon: ArchiveIcon },
  // { label: "Knowledge Center", path: "/", icon: KnowledgeCenterIcon },
  {
    label: "About",
    path: "/about",
    icon: InformationIcon,
    exact: true,
  },
];

const FOOTER: readonly NavItem[] = [
  {
    label: "Settings",
    path: "/settings",
    icon: SettingsIcon,
    exact: true,
    requiredPermission: Permission.ViewUsers,
  },
];

const APP_NAME = "PartitionPro";
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "v0.0.0";

export default function Sidebar({
  expanded,
  onExpandedChange,
}: {
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const visibleNav = React.useMemo(
    () =>
      NAV.filter(
        (item) =>
          !item.requiredPermission || canGlobal(user, item.requiredPermission)
      ),
    [user]
  );

  const isActive = (it: NavItem) =>
    it.exact ? pathname === it.path : pathname.startsWith(it.path);

  return (
    <div aria-hidden="false">
      {/* component-scoped style (doesn't bloat index.css) */}
      <SideNav
        aria-label="Side navigation"
        isFixedNav
        isRail
        expanded={expanded}
        onMouseEnter={() => onExpandedChange(true)}
        onMouseLeave={() => onExpandedChange(false)}
        className="z-30"
        style={{
          position: "fixed",
          left: 0,
          top: "var(--app-header-h, 48px)",
          height: "calc(100vh - var(--app-header-h, 48px))",
          width: expanded ? 256 : 56,
          zIndex: 40,
        }}
      >
        <SideNavItems>
          {visibleNav.map((it) => (
            <SidebarItem
              key={it.path}
              icon={it.icon}
              label={it.label}
              active={isActive(it)}
              onClick={() => navigate(it.path)}
            />
          ))}

          <SideNavDivider />

          {canGlobal(user, Permission.ViewUsers) &&
            FOOTER.map((it) => (
              <SidebarItem
                key={it.path}
                icon={it.icon}
                label={it.label}
                active={isActive(it)}
                onClick={() => navigate(it.path)}
              />
            ))}
        </SideNavItems>

        <SideNavDivider />

        <div className="bpp-sidenav-footer" role="contentinfo">
          <div
            className={`flex flex-col justify-center px-3 py-3 text-xs text-gray-600 ${
              expanded ? "items-start" : "items-center"
            }`}
          >
            <span className="font-semibold text-gray-900">
              {expanded ? APP_NAME : "PP"}
            </span>

            {expanded && (
              <span className="text-[11px] text-gray-500 mt-0.5">
                {APP_VERSION}
              </span>
            )}
          </div>
        </div>
      </SideNav>
    </div>
  );
}
