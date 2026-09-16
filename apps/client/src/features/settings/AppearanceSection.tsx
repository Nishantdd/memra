import { Button, RadioButton, RadioButtonGroup, Stack } from "@carbon/react";
import { THEME_STORAGE_KEY } from "../../constants/index.ts";
import { type ContentTheme, setTheme, useTheme } from "../../lib/theme.ts";

const THEMES: { value: ContentTheme; label: string }[] = [
  { value: "white", label: "Light (white)" },
  { value: "g10", label: "Light (gray 10)" },
  { value: "g90", label: "Dark (gray 90)" },
  { value: "g100", label: "Dark (gray 100)" },
];

export function AppearanceSection() {
  const theme = useTheme();
  const followsSystem = localStorage.getItem(THEME_STORAGE_KEY) === null;

  const useSystem = () => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "g100" : "g10", false);
  };

  return (
    <Stack gap={5}>
      <RadioButtonGroup
        legendText="Theme"
        name="theme"
        orientation="vertical"
        valueSelected={theme}
        onChange={(value) => setTheme(value as ContentTheme)}
      >
        {THEMES.map((t) => (
          <RadioButton key={t.value} id={`theme-${t.value}`} value={t.value} labelText={t.label} />
        ))}
      </RadioButtonGroup>
      <div className="memra-settings__row">
        <Button kind="tertiary" size="md" onClick={useSystem} disabled={followsSystem}>
          {followsSystem ? "Following system preference" : "Follow system preference"}
        </Button>
      </div>
    </Stack>
  );
}
