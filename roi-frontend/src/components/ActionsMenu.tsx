import { OverflowMenu, OverflowMenuItem } from "@bain/design-system";
import DotsVertical from "./icons/VerticalDots";
import { canGlobal, Permission } from "@/core/rbac";
import { useAuth } from "@/core/auth/authContext";

export type ActionsMenuExtraItem = {
  key: string;
  label: string;
  onClick: () => void;
  isDelete?: boolean;
};

export type ActionsPermissionMap = {
  view?: Permission;
  edit?: Permission;
  delete?: Permission;
  extra?: Record<string, Permission>;
};

export type ActionsMenuProps = {
  entity?: "case" | "user" | "partition" | string;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  extraItems?: ActionsMenuExtraItem[];
  permissions?: ActionsPermissionMap;
  labels?: {
    view?: string;
    edit?: string;
    delete?: string;
  };

  direction?: "top" | "bottom";
  align?: "left" | "right";
};

export default function ActionsMenu({
  entity = "item",
  onView,
  onEdit,
  onDelete,
  extraItems,
  labels,
  direction = "bottom",
  align = "right",
  permissions,
}: ActionsMenuProps) {
  const { user } = useAuth();

  const canView = permissions?.view ? canGlobal(user, permissions.view) : true;
  const canEdit = permissions?.edit ? canGlobal(user, permissions.edit) : true;
  const canDelete = permissions?.delete
    ? canGlobal(user, permissions.delete)
    : true;

  const flipped = align === "right";
  const tooltipAlign = align === "right" ? "left" : "right";

  const defaultLabel = (action: string) => {
    const formattedEntity = entity.toLowerCase();
    if (formattedEntity === "user" || formattedEntity === "case") {
      return `${action} ${formattedEntity}`;
    }
    // default keeps your old behavior for anything else
    return `${action} item`;
  };

  const viewText = labels?.view ?? defaultLabel("View");
  const editText = labels?.edit ?? defaultLabel("Edit");
  const deleteText =
    labels?.delete ??
    defaultLabel(entity.toLowerCase() === "user" ? "Delete" : "Archive");

  const mergedItems: ActionsMenuExtraItem[] = [
    ...(extraItems ?? []).filter((it) => {
      const perm = permissions?.extra?.[it.key];
      return perm ? canGlobal(user, perm) : true;
    }),

    ...(onView && canView
      ? [{ key: "__view", label: viewText, onClick: onView }]
      : []),

    ...(onEdit && canEdit
      ? [{ key: "__edit", label: editText, onClick: onEdit }]
      : []),

    ...(onDelete && canDelete
      ? [
          {
            key: "__delete",
            label: deleteText,
            onClick: onDelete,
          },
        ]
      : []),
  ];

  // If nothing to show, don't render the dots
  if (mergedItems.length === 0) return null;

  return (
    <div className="camenu__wrap" style={{ display: "inline-flex" }}>
      <style>{`
        .camenu__wrap :where(button.cds--overflow-menu__trigger){
          display:inline-flex;align-items:center;justify-content:center;
          width:28px;height:28px;border-radius:6px;border:0;background:transparent;
          color:#525252;
        }
        .camenu__wrap :where(button.cds--overflow-menu__trigger:hover){ background:#f3f3f3; }
        .camenu__wrap :where(button.cds--overflow-menu__trigger:focus-visible){ box-shadow:0 0 0 2px #C41230 inset; }
        .camenu__wrap .camenu__icon{ display:block;width:16px;height:16px;fill:currentColor; }
        button.cds--overflow-menu.cds--overflow-menu--sm.cds--btn.cds--btn--sm.cds--layout--size-sm.cds--btn--ghost.cds--btn--icon-only {
          padding-bottom:20px;
        }
        .cds--overflow-menu-options__btn,
        .cds--overflow-menu-options__option--danger .cds--overflow-menu-options__btn:hover,
        .cds--overflow-menu-options__option--danger .cds--overflow-menu-options__btn:focus {
          background-color:transparent;
          color:var(--cds-text-secondary, #4B4949);
        }
      `}</style>

      <OverflowMenu
        size="sm"
        direction={direction}
        flipped={flipped}
        align={tooltipAlign}
        autoAlign
        iconDescription={`More ${entity} actions`}
        renderIcon={() => <DotsVertical className="camenu__icon" />}
      >
        {mergedItems.map((it) => (
          <OverflowMenuItem
            key={it.key}
            itemText={it.label}
            onClick={it.onClick}
            isDelete={!!it.isDelete}
          />
        ))}
      </OverflowMenu>
    </div>
  );
}
