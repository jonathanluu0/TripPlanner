import type { ReactNode } from 'react';
import { Link, useMatch, useNavigate } from 'react-router-dom';
import {
  ActionIcon,
  AppShell,
  Container,
  Group,
  Select,
  Text,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { IconMap, IconMoon, IconSun } from '@tabler/icons-react';
import { useTripStore } from '../store/tripStore';

function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const next = computed === 'dark' ? 'light' : 'dark';
  return (
    <Tooltip label={`Switch to ${next} mode`}>
      <ActionIcon
        variant="default"
        size="lg"
        aria-label="Toggle color scheme"
        onClick={() => setColorScheme(next)}
      >
        {computed === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}

/** Quick jump between trips; only shown inside a trip. */
function TripSwitcher({ currentTripId }: { currentTripId: string }) {
  const trips = useTripStore((s) => s.trips);
  const navigate = useNavigate();
  const data = Object.values(trips)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((t) => ({ value: t.id, label: t.name }));
  if (data.length < 2) return null;
  return (
    <Select
      aria-label="Switch trip"
      data={data}
      value={currentTripId}
      onChange={(id) => id && navigate(`/trip/${id}`)}
      allowDeselect={false}
      w={200}
      visibleFrom="sm"
      comboboxProps={{ withinPortal: true }}
    />
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const tripMatch = useMatch('/trip/:tripId');
  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Container size="xl" h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap">
            <UnstyledButton component={Link} to="/" aria-label="Home">
              <Group gap="xs" wrap="nowrap">
                <ThemeIcon variant="gradient" gradient={{ from: 'teal', to: 'cyan' }} size="lg">
                  <IconMap size={20} />
                </ThemeIcon>
                <Text fw={800} size="lg" visibleFrom="xs">
                  Group Trip Planner
                </Text>
              </Group>
            </UnstyledButton>
            <Group gap="sm" wrap="nowrap">
              {tripMatch?.params.tripId && <TripSwitcher currentTripId={tripMatch.params.tripId} />}
              <ColorSchemeToggle />
            </Group>
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="xl" px={0}>
          {children}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
