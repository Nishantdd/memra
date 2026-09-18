import { RadioButton, RadioButtonGroup, Stack } from "@carbon/react";
import type { ContentTheme } from "shared";
import { getPreference, isDarkTheme, setTheme, useTheme } from "../../lib/theme.ts";

const THEMES: { value: ContentTheme; label: string }[] = [
  { value: "white", label: "Light (white)" },
  { value: "g10", label: "Light (gray 10)" },
  { value: "g90", label: "Dark (gray 90)" },
  { value: "g100", label: "Dark (gray 100)" },
];

export function AppearanceSection() {
  const theme = useTheme();
  const preference = getPreference();

  return (
    <Stack gap={5}>
      <RadioButtonGroup
        legendText="Theme"
        name="theme"
        orientation="vertical"
        valueSelected={preference}
        onChange={(value) => setTheme(value as ContentTheme | "system")}
      >
        <RadioButton id="theme-system" value="system" labelText="Follow system preference" />
        {THEMES.map((t) => (
          <RadioButton key={t.value} id={`theme-${t.value}`} value={t.value} labelText={t.label} />
        ))}
      </RadioButtonGroup>
    </Stack>
  );
}
