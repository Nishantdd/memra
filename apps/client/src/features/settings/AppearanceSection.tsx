import { Button, InlineNotification, RadioButton, RadioButtonGroup, Stack } from "@carbon/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ContentTheme } from "shared";
import { orpc } from "../../data/api/orpc.ts";
import { applyServerTheme, isFollowingSystem, setTheme, useTheme } from "../../lib/theme.ts";

const THEMES: { value: ContentTheme; label: string }[] = [
  { value: "white", label: "Light (white)" },
  { value: "g10", label: "Light (gray 10)" },
  { value: "g90", label: "Dark (gray 90)" },
  { value: "g100", label: "Dark (gray 100)" },
];

export function AppearanceSection() {
  const theme = useTheme();
  const followsSystem = isFollowingSystem();
  const qc = useQueryClient();

  const update = useMutation(
    orpc.settings.update.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.settings.key() }),
    }),
  );

  const selectTheme = (value: ContentTheme) => {
    setTheme(value);
    update.mutate({ appearance: { theme: value } });
  };

  const useSystem = () => {
    applyServerTheme(null);
    update.mutate({ appearance: { theme: null } });
  };

  return (
    <Stack gap={5}>
      <RadioButtonGroup
        legendText="Theme"
        name="theme"
        orientation="vertical"
        valueSelected={theme}
        onChange={(value) => selectTheme(value as ContentTheme)}
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
      {update.isError && (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title="Couldn't save appearance."
        />
      )}
    </Stack>
  );
}
