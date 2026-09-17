import { useEffect } from "react";

const APP_NAME = "Memra";

/**
 * Sets the document title to `"Memra | <subtitle>"`, or just `"Memra"` when
 * no subtitle is provided.  Restores the bare app name on unmount.
 */
export function usePageTitle(subtitle?: string | null): void {
  useEffect(() => {
    document.title = subtitle ? `${APP_NAME} | ${subtitle}` : APP_NAME;
    return () => {
      document.title = APP_NAME;
    };
  }, [subtitle]);
}
