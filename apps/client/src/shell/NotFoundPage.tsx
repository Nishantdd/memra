import { Column, Grid, Link } from "@carbon/react";
import { Link as RouterLink } from "react-router";
import { usePageTitle } from "../lib/usePageTitle.ts";

export function NotFoundPage() {
  usePageTitle("Not Found");
  return (
    <Grid>
      <Column sm={4} md={8} lg={8}>
        <h1 className="memra-page-title">Page not found</h1>
        <p className="memra-empty__body">The page you are looking for doesn't exist.</p>
        <Link as={RouterLink} to="/">
          Back to all notes
        </Link>
      </Column>
    </Grid>
  );
}
