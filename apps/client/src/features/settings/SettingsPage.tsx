import { Column, Grid, Tab, TabList, TabPanel, TabPanels, Tabs } from "@carbon/react";
import { Navigate, useNavigate, useParams } from "react-router";
import { AppearanceSection } from "./AppearanceSection.tsx";
import { DataSettings } from "./DataSettings.tsx";
import { SearchSettings } from "./SearchSettings.tsx";
import { SecuritySettings } from "./SecuritySettings.tsx";

const TABS = [
  { id: "search", label: "Search", Component: SearchSettings },
  { id: "appearance", label: "Appearance", Component: AppearanceSection },
  { id: "security", label: "Security", Component: SecuritySettings },
  { id: "data", label: "Data", Component: DataSettings },
] as const;

export function SettingsPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const index = TABS.findIndex((t) => t.id === tab);
  if (index === -1) return <Navigate to={`/settings/${TABS[0].id}`} replace />;

  return (
    <Grid>
      <Column sm={4} md={8} lg={16}>
        <h1 className="memra-page-title">Settings</h1>
        <Tabs
          selectedIndex={index}
          onChange={({ selectedIndex }) => void navigate(`/settings/${TABS[selectedIndex]!.id}`)}
        >
          <TabList aria-label="Settings sections" contained>
            {TABS.map((t) => (
              <Tab key={t.id}>{t.label}</Tab>
            ))}
          </TabList>
          <TabPanels>
            {TABS.map(({ id, Component }) => (
              <TabPanel key={id}>{id === tab && <Component />}</TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      </Column>
    </Grid>
  );
}
