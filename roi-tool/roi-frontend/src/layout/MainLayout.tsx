import * as React from "react";
import { Outlet, useLocation } from "react-router-dom";
import AppHeader from "@/components/header/Header";
import Sidebar from "@/components/sidebar/Sidebar";
import Footer from "@/components/Footer";
import ViewUserModal from "@/components/ViewUserModal";
import { useAuth } from "@/core/auth/authContext";

export default function MainLayout() {
  const location = useLocation();
  const isDashboard = location.pathname === "/dashboard";
  const isAbout = location.pathname === "/about";

  const { user, logout } = useAuth();

  // Sidebar hover / pin logic
  const [isHoveringNav, setIsHoveringNav] = React.useState(false);
  const [isNavPinned, setIsNavPinned] = React.useState(false);
  const hoverTimeoutRef = React.useRef<number | null>(null);

  const setHoverState = (value: boolean) => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    if (value) {
      setIsHoveringNav(true);
    } else {
      hoverTimeoutRef.current = window.setTimeout(() => {
        setIsHoveringNav(false);
      }, 150);
    }
  };

  const navVisible = isNavPinned || isHoveringNav;

  const handleToggleNavPinned = () => {
    setIsNavPinned((prev) => !prev);
  };

  const handleSidebarExpandedChange = (expanded: boolean) => {
    if (!expanded) {
      setIsNavPinned(false);
      setIsHoveringNav(false);
    } else {
      setIsNavPinned(true);
    }
  };

  // Profile modal state
  const [viewingProfile, setViewingProfile] = React.useState(false);

  const onProfile = () => {
    setViewingProfile(true);
  };

  return (
    <div
      className={`min-h-screen flex flex-col text-gray-800 ${
        isDashboard ? "bg-black" : "bg-gray-50"
      }`}
    >
      {/* Header */}
      <AppHeader
        navExpanded={navVisible}
        onNavToggle={handleToggleNavPinned}
        onNavHoverStart={() => setHoverState(true)}
        onNavHoverEnd={() => setHoverState(false)}
        user={user}
        onLogout={logout}
        onProfile={onProfile}
      />

      {/* Sidebar + main */}
      <div className="relative flex-1">
        {navVisible && (
          <div
            className="fixed inset-y-0 left-0 z-40 flex"
            onMouseEnter={() => setHoverState(true)}
            onMouseLeave={() => setHoverState(false)}
          >
            <Sidebar
              expanded={navVisible}
              onExpandedChange={handleSidebarExpandedChange}
            />
          </div>
        )}

        <main>
          <div className={isDashboard || isAbout ? "" : "p-6"}>
            {/* 🔑 Nested routes render here */}
            <Outlet />
          </div>
        </main>
      </div>

      <Footer />

      {/* Profile modal */}
      <ViewUserModal
        open={viewingProfile}
        onClose={() => setViewingProfile(false)}
        data={user}
      />
    </div>
  );
}
