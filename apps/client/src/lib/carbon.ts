// Carbon's v12 OverflowMenu (MenuItem children with icons) is only reachable behind a feature
// flag through the main export, which keeps the legacy prop types. Import it directly instead.
export { OverflowMenu as IconMenu } from "@carbon/react/es/components/OverflowMenu/next/index.js";
export { MenuItem, MenuItemDivider } from "@carbon/react";
