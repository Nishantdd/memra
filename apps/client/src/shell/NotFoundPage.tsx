import { Column, Grid, Link } from "@carbon/react";
import { Link as RouterLink } from "react-router";

export function NotFoundPage() {
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
