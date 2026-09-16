import { Column, Grid } from "@carbon/react";
import type { ReactNode } from "react";
import { useConnectivity } from "../../data/sync/connectivity.ts";
import { AboutSection } from "./AboutSection.tsx";
import { AppearanceSection } from "./AppearanceSection.tsx";
import { ImportExportSection } from "./ImportExportSection.tsx";
import { OfflineStorageSection } from "./OfflineStorageSection.tsx";
import { SearchIndexSection } from "./SearchIndexSection.tsx";
import { SecuritySection } from "./SecuritySection.tsx";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="memra-settings__section" aria-labelledby={id}>
      <h2 id={id} className="memra-section__heading">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function SettingsPage() {
  const { connectivity } = useConnectivity();
  const readOnly = connectivity === "offline";

  return (
    <Grid className="memra-page">
      <Column sm={4} md={8} lg={16} className="memra-page__title-row">
        <h1 className="memra-page-title">Settings</h1>
      </Column>
      <Column sm={4} md={8} lg={8}>
        <Section id="settings-appearance" title="Appearance">
          <AppearanceSection />
        </Section>
        <Section id="settings-security" title="Security">
          <SecuritySection readOnly={readOnly} />
        </Section>
        <Section id="settings-search" title="Search index">
          <SearchIndexSection readOnly={readOnly} />
        </Section>
        <Section id="settings-offline" title="Offline storage">
          <OfflineStorageSection />
        </Section>
        <Section id="settings-import-export" title="Import and export">
          <ImportExportSection readOnly={readOnly} />
        </Section>
        <Section id="settings-about" title="About">
          <AboutSection readOnly={readOnly} />
        </Section>
      </Column>
    </Grid>
  );
}
