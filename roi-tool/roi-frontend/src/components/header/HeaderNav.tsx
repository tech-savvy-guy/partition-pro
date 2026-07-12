import { useAuth } from "@/core/auth/authContext";
import { canGlobal, Permission } from "@/core/rbac";
import React from "react";
import { Link, useLocation } from "react-router-dom";

type NavChild = {
  label: string;
  to: string;
  description?: string;
};

type NavItem = {
  key: string;
  label: string;
  to?: string;
  description: string;
  children?: NavChild[];
  sectionTitle?: string;
  requiredPermission?: Permission;
};

const NAV: NavItem[] = [
  {
    key: "home",
    label: "Home",
    to: "/dashboard",
    description: "Return to your workspace overview and quick actions.",
  },
  {
    key: "cases",
    label: "Cases",
    to: "/cases",
    description: "Create, browse and manage ROI cases across markets.",
    sectionTitle: "By activity",
    children: [
      {
        label: "Current Cases",
        to: "/cases",
        description: "Open and active cases.",
      },
      {
        label: "Archived Cases",
        to: "/archive",
        description: "Closed and archived work.",
      },
    ],
  },
  {
    key: "knowledge",
    label: "Knowledge center",
    // IMPORTANT: no `to` => so "Go to ..." won’t render from item.to
    description:
      "Guides, playbooks, FAQs and training content for PartitionPro.",
    sectionTitle: "Explore",
    children: [], // or leave it out
  },
  {
    key: "settings",
    label: "Settings",
    to: "/settings",
    description: "Manage preferences, defaults, and access settings.",
    requiredPermission: Permission.ViewUsers,
  },
  {
    key: "about",
    label: "About",
    to: "/about",
    description: "Learn more about PartitionPro, owners, and version info.",
  },
];

function HeaderNavPanel({
  item,
  onStayOpen,
  onScheduleClose,
  onCloseNow,
}: {
  item: NavItem;
  onStayOpen: () => void;
  onScheduleClose: () => void;
  onCloseNow: () => void;
}) {
  return (
    <div
      className="bpp-nav-panel"
      onMouseEnter={onStayOpen}
      onMouseLeave={onScheduleClose}
    >
      <div className="bpp-nav-panel__inner">
        <div className="bpp-nav-panel__grid">
          {/* Left */}
          <div>
            <h3 className="text-[28px] font-semibold text-gray-900">
              {item.label}
            </h3>

            <p className="mt-3 text-[16px] leading-7 text-gray-600 max-w-2xl">
              {item.description}
            </p>

            {item.to && (
              <div className="mt-5">
                <Link
                  to={item.to}
                  className="text-[#C41230] font-medium hover:underline"
                  onClick={onCloseNow}
                >
                  Go to {item.label}
                </Link>
              </div>
            )}
            {/* Knowledge center: show link but disabled */}
            {item.key === "knowledge" && (
              <div className="mt-5">
                <span className="text-gray-400 font-medium cursor-not-allowed">
                  Go to {item.label}
                </span>
              </div>
            )}
          </div>

          {/* Right */}
          <div className="bpp-nav-panel__right">
            <p className="text-sm text-gray-500 mb-4">
              {item.sectionTitle ?? "Explore"}
            </p>

            <div className="space-y-4">
              {(item.children ?? []).length === 0 ? (
                <p className="text-sm text-gray-500">
                  No sub-items — use this section for quick guidance.
                </p>
              ) : (
                item.children?.map((c) => (
                  <Link
                    key={c.to}
                    to={c.to}
                    onClick={onCloseNow}
                    className="block group"
                  >
                    <div className="text-[15px] font-semibold text-gray-900 group-hover:text-[#C41230]">
                      {c.label}
                    </div>
                    {c.description && (
                      <div className="text-[13px] text-gray-500 mt-1">
                        {c.description}
                      </div>
                    )}
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HeaderNav() {
  const { pathname } = useLocation();
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const closeTimer = React.useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const { user } = useAuth();

  const visibleNav = React.useMemo(
    () =>
      NAV.filter(
        (item) => !item.requiredPermission || canGlobal(user, item.requiredPermission)
      ),
    [user]
  );

  const open = (key: string) => {
    cancelClose();
    setOpenKey(key);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpenKey(null), 250);
  };

  const closeNow = () => {
    cancelClose();
    setOpenKey(null);
  };

  const activeClass = "text-[#C41230] border-b-2 border-[#C41230]";
  const inactiveClass = "text-gray-800 hover:text-[#C41230]";

  const openItem = NAV.find((n) => n.key === openKey) ?? null;

  return (
    <div className="relative w-full">
      {/* Top nav row */}
      <nav className="flex items-center justify-start gap-10 h-12">
        {visibleNav.map((item) => {
          const isActive =
            item.to &&
            (pathname === item.to || pathname.startsWith(item.to + "/"));

          const isOpen = openKey === item.key;

          return (
            <div
              key={item.key}
              className="relative"
              onMouseEnter={() => open(item.key)}
              onMouseLeave={scheduleClose}
            >
              <Link
                to={item.to ?? pathname}
                onClick={(e) => {
                  if (!item.to) e.preventDefault();
                }}
                className={`
                        inline-flex items-center
                        text-[15px]
                        font-semibold
                        tracking-[0.01em]
                        h-12
                        ${isActive ? activeClass : inactiveClass}
                        ${isActive ? activeClass : inactiveClass}
                        `}
              >
                {item.label}
                <span
                  aria-hidden="true"
                  className={`ml-2 text-[12px] translate-y-[1px] bpp-nav-caret ${
                    isOpen ? "bpp-nav-caret--open" : ""
                  }`}
                >
                  ▾
                </span>
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Hover panel */}
      {openItem && (
        <HeaderNavPanel
          item={openItem}
          onStayOpen={cancelClose}
          onScheduleClose={scheduleClose}
          onCloseNow={closeNow}
        />
      )}
    </div>
  );
}
