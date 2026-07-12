import React from "react";
import { SideNavLink } from "@bain/design-system";

type Props = {
  icon: React.ComponentType<any>;  // component, not JSX
  label: string;
  active?: boolean;
  onClick?: () => void;
};

export default function SidebarItem({ icon: Icon, label, active=false, onClick }: Props) {
  return (
    <SideNavLink renderIcon={Icon} isActive={active} onClick={onClick}>
      {label}
    </SideNavLink>
  );
}
