import { Asleep, FolderAdd, Light, Logout, Settings, UserAvatar } from "@carbon/icons-react";
import {
  Header,
  HeaderContainer,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderMenu,
  HeaderMenuButton,
  HeaderMenuItem,
  HeaderName,
  HeaderNavigation,
  HeaderSideNavItems,
  SideNav,
  SideNavItems,
  SkipToContent,
  Theme,
} from "@carbon/react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { INLINE_FOLDER_TABS } from "../constants/index.ts";
import { useFolders } from "../data/queries.ts";
import { useLogout } from "../features/auth/useLogout.ts";
import { CreateFolderModal } from "../features/folders/FolderDialogs.tsx";
import { IconMenu, MenuItem, MenuItemDivider } from "../lib/carbon.ts";
import { isDarkTheme, setTheme, useTheme } from "../lib/theme.ts";
import { StatusTag } from "./StatusTag.tsx";

export function AppHeader() {
  const folders = useFolders() ?? [];
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const logout = useLogout();
  const [creating, setCreating] = useState(false);

  const activeFolderId = location.pathname.startsWith("/f/") ? location.pathname.slice(3) : null;
  const inline = folders.slice(0, INLINE_FOLDER_TABS);
  const overflow = folders.slice(INLINE_FOLDER_TABS);
  const items = (list: typeof folders, onClick?: () => void) =>
    list.map((f) => (
      <HeaderMenuItem
        key={f.id}
        as={Link}
        to={`/f/${f.id}`}
        isActive={activeFolderId === f.id}
        onClick={onClick}
      >
        {f.name}
      </HeaderMenuItem>
    ));

  return (
    <HeaderContainer
      render={({ isSideNavExpanded, onClickSideNavExpand }) => (
        <Theme theme="g100">
          <Header aria-label="Memra">
            <SkipToContent href="#main-content" />
            <HeaderMenuButton
              aria-label={isSideNavExpanded ? "Close folders" : "Open folders"}
              onClick={onClickSideNavExpand}
              isActive={isSideNavExpanded}
              aria-expanded={isSideNavExpanded}
            />
            <HeaderName as={Link} to="/" prefix="">
              Memra
            </HeaderName>
            <HeaderNavigation aria-label="Folders">
              <HeaderMenuItem as={Link} to="/" isActive={location.pathname === "/"}>
                All notes
              </HeaderMenuItem>
              {items(inline)}
              {overflow.length > 0 && (
                <HeaderMenu
                  aria-label="More folders"
                  menuLinkName="More"
                  isActive={overflow.some((f) => f.id === activeFolderId)}
                >
                  {items(overflow)}
                </HeaderMenu>
              )}
            </HeaderNavigation>
            <HeaderGlobalBar>
              <StatusTag />
              <HeaderGlobalAction
                aria-label="New folder"
                tooltipAlignment="end"
                onClick={() => setCreating(true)}
              >
                <FolderAdd size={20} />
              </HeaderGlobalAction>
              <HeaderGlobalAction
                aria-label={isDarkTheme(theme) ? "Switch to light theme" : "Switch to dark theme"}
                tooltipAlignment="end"
                onClick={() => setTheme(isDarkTheme(theme) ? "g10" : "g100")}
              >
                {isDarkTheme(theme) ? <Light size={20} /> : <Asleep size={20} />}
              </HeaderGlobalAction>
              <IconMenu
                label="Account"
                renderIcon={UserAvatar}
                size="lg"
                menuAlignment="bottom-end"
                tooltipAlignment="bottom-end"
              >
                <MenuItem
                  label="Settings"
                  renderIcon={Settings}
                  onClick={() => void navigate("/settings")}
                />
                <MenuItemDivider />
                <MenuItem label="Sign out" renderIcon={Logout} onClick={() => void logout()} />
              </IconMenu>
            </HeaderGlobalBar>
            <SideNav
              aria-label="Folders"
              expanded={isSideNavExpanded}
              isPersistent={false}
              onOverlayClick={onClickSideNavExpand}
            >
              <SideNavItems>
                <HeaderSideNavItems>
                  <HeaderMenuItem
                    as={Link}
                    to="/"
                    isActive={location.pathname === "/"}
                    onClick={onClickSideNavExpand}
                  >
                    All notes
                  </HeaderMenuItem>
                  {items(folders, onClickSideNavExpand)}
                </HeaderSideNavItems>
              </SideNavItems>
            </SideNav>
          </Header>
          <CreateFolderModal
            open={creating}
            onClose={() => setCreating(false)}
            onCreated={(f) => void navigate(`/f/${f.id}`)}
          />
        </Theme>
      )}
    />
  );
}
