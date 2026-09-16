import { Add, Asleep, Light, Logout, UserAvatar } from "@carbon/icons-react";
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
  HeaderPanel,
  HeaderSideNavItems,
  SideNav,
  SideNavItems,
  SkipToContent,
  Switcher,
  SwitcherDivider,
  SwitcherItem,
  Theme,
} from "@carbon/react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useFolders } from "../data/queries.ts";
import { useConnectivity } from "../data/sync/connectivity.ts";
import { CreateFolderModal } from "../features/folders/FolderDialogs.tsx";
import { isDarkTheme, setTheme, useTheme } from "../lib/theme.ts";
import { useLogout } from "../features/auth/useLogout.ts";
import { ConnectivityStatus } from "./ConnectivityStatus.tsx";

const INLINE_TABS = 8;

export function AppHeader() {
  const folders = useFolders() ?? [];
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { connectivity } = useConnectivity();
  const readOnly = connectivity === "offline";
  const [creating, setCreating] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const logout = useLogout();

  const activeFolderId = location.pathname.startsWith("/f/") ? location.pathname.slice(3) : null;
  const inline = folders.slice(0, INLINE_TABS);
  const overflow = folders.slice(INLINE_TABS);

  const folderItems = (items: typeof folders) =>
    items.map((f) => (
      <HeaderMenuItem key={f.id} as={Link} to={`/f/${f.id}`} isActive={activeFolderId === f.id}>
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
              {folderItems(inline)}
              {overflow.length > 0 && (
                <HeaderMenu
                  aria-label="More folders"
                  menuLinkName="More"
                  isActive={overflow.some((f) => f.id === activeFolderId)}
                >
                  {folderItems(overflow)}
                </HeaderMenu>
              )}
              {!readOnly && (
                <HeaderMenuItem
                  as="button"
                  type="button"
                  onClick={() => setCreating(true)}
                  className="memra-header__add"
                >
                  <Add size={16} aria-hidden /> New folder
                </HeaderMenuItem>
              )}
            </HeaderNavigation>
            <HeaderGlobalBar>
              <ConnectivityStatus />
              <HeaderGlobalAction
                aria-label={isDarkTheme(theme) ? "Switch to light theme" : "Switch to dark theme"}
                tooltipAlignment="end"
                onClick={() => setTheme(isDarkTheme(theme) ? "g10" : "g100")}
              >
                {isDarkTheme(theme) ? <Light size={20} /> : <Asleep size={20} />}
              </HeaderGlobalAction>
              <HeaderGlobalAction
                aria-label="Account"
                tooltipAlignment="end"
                isActive={accountOpen}
                onClick={() => setAccountOpen((o) => !o)}
              >
                <UserAvatar size={20} />
              </HeaderGlobalAction>
            </HeaderGlobalBar>
            <HeaderPanel aria-label="Account" expanded={accountOpen} onHeaderPanelFocus={() => {}}>
              <Switcher aria-label="Account actions">
                <SwitcherItem
                  aria-label="Settings"
                  onClick={() => {
                    setAccountOpen(false);
                    void navigate("/settings");
                  }}
                >
                  Settings
                </SwitcherItem>
                {!readOnly && (
                  <>
                    <SwitcherDivider />
                    <SwitcherItem aria-label="Sign out" onClick={() => logout()}>
                      <Logout size={16} aria-hidden /> Sign out
                    </SwitcherItem>
                  </>
                )}
              </Switcher>
            </HeaderPanel>
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
                  {folders.map((f) => (
                    <HeaderMenuItem
                      key={f.id}
                      as={Link}
                      to={`/f/${f.id}`}
                      isActive={activeFolderId === f.id}
                      onClick={onClickSideNavExpand}
                    >
                      {f.name}
                    </HeaderMenuItem>
                  ))}
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
