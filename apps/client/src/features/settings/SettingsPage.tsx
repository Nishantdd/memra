import { Column, Grid } from "@carbon/react";
import { useConnectivity } from "../../data/sync/connectivity.ts";
import { ImportExportSection } from "./ImportExportSection.tsx";

export function SettingsPage() {
  const { connectivity } = useConnectivity();
  const readOnly = connectivity === "offline";

  return (
    <Grid className="memra-page">
      <Column sm={4} md={8} lg={16} className="memra-page__title-row">
        <h1 className="memra-page-title">Settings</h1>
      </Column>
      <Column sm={4} md={8} lg={8}>
        <section className="memra-settings__section" aria-labelledby="settings-import-export">
          <h2 id="settings-import-export" className="memra-section__heading">
            Import and export
          </h2>
          <ImportExportSection readOnly={readOnly} />
        </section>
      </Column>
    </Grid>
  );
}
