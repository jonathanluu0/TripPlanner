import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Card,
  Center,
  CopyButton,
  Group,
  Menu,
  Modal,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { modals } from '@mantine/modals';
import {
  IconCalendar,
  IconCar,
  IconCheck,
  IconDots,
  IconLink,
  IconMapPin,
  IconPencil,
  IconReceipt,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { useTrip, useTripStore } from '../store/tripStore';
import { MemberAvatar } from '../components/MemberAvatar';
import { formatDateRange, inviteLink } from '../lib/dates';
import { PeoplePanel } from '../features/people/PeoplePanel';
import { LogisticsBoard } from '../features/logistics/LogisticsBoard';
import { ReceiptsPanel } from '../features/receipts/ReceiptsPanel';
import type { Trip } from '../types';

const TABS = ['people', 'logistics', 'expenses'] as const;
type TabValue = (typeof TABS)[number];
const isTab = (v: string | null): v is TabValue => !!v && (TABS as readonly string[]).includes(v);

function EditTripModal({ trip, opened, onClose }: { trip: Trip; opened: boolean; onClose: () => void }) {
  const updateTrip = useTripStore((s) => s.updateTrip);
  const [name, setName] = useState(trip.name);
  const [destination, setDestination] = useState(trip.destination ?? '');
  const [range, setRange] = useState<[string | null, string | null]>([
    trip.startDate ?? null,
    trip.endDate ?? null,
  ]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateTrip(trip.id, {
      name: name.trim(),
      destination: destination.trim() || undefined,
      startDate: range[0] ?? undefined,
      endDate: range[1] ?? range[0] ?? undefined,
    });
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Edit trip" centered>
      <form onSubmit={submit}>
        <Stack>
          <TextInput label="Trip name" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <TextInput
            label="Destination"
            leftSection={<IconMapPin size={16} />}
            value={destination}
            onChange={(e) => setDestination(e.currentTarget.value)}
          />
          <DatePickerInput
            type="range"
            label="Dates"
            leftSection={<IconCalendar size={16} />}
            clearable
            allowSingleDateInRange
            value={range}
            onChange={(v) => setRange([v[0] ?? null, v[1] ?? null])}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function TripHeader({ trip }: { trip: Trip }) {
  const deleteTrip = useTripStore((s) => s.deleteTrip);
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const dates = formatDateRange(trip.startDate, trip.endDate);
  const shown = trip.members.slice(0, 6);
  const extra = trip.members.length - shown.length;

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: `Delete "${trip.name}"?`,
      children: <Text size="sm">This removes the trip, its people, cars, beds and receipts. It can't be undone.</Text>,
      labels: { confirm: 'Delete trip', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        deleteTrip(trip.id);
        navigate('/');
      },
    });

  return (
    <Card padding="lg">
      <Group justify="space-between" align="flex-start" gap="md">
        <Stack gap={4} style={{ minWidth: 0 }}>
          <Group gap="xs" wrap="nowrap">
            <Title order={2} lineClamp={1}>
              {trip.name}
            </Title>
            <Menu position="bottom-start" withinPortal>
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" aria-label="Trip options">
                  <IconDots size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconPencil size={16} />} onClick={() => setEditOpen(true)}>
                  Edit trip
                </Menu.Item>
                <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={confirmDelete}>
                  Delete trip
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
          <Group gap="md" c="dimmed">
            {trip.destination && (
              <Group gap={4}>
                <IconMapPin size={16} />
                <Text size="sm">{trip.destination}</Text>
              </Group>
            )}
            {dates && (
              <Group gap={4}>
                <IconCalendar size={16} />
                <Text size="sm">{dates}</Text>
              </Group>
            )}
          </Group>
        </Stack>

        <Stack gap="xs" align="flex-end">
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              Invite code
            </Text>
            <Badge size="lg" variant="light" ff="monospace" style={{ letterSpacing: 2 }}>
              {trip.inviteCode}
            </Badge>
            <CopyButton value={inviteLink(trip.inviteCode)} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Link copied' : 'Copy invite link'} withArrow>
                  <ActionIcon variant="light" color={copied ? 'teal' : 'gray'} onClick={copy} aria-label="Copy invite link">
                    {copied ? <IconCheck size={16} /> : <IconLink size={16} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
          <Avatar.Group spacing={4}>
            {shown.map((m) => (
              <MemberAvatar key={m.id} member={m} size="md" withTooltip />
            ))}
            {extra > 0 && (
              <Avatar size="md" radius="xl">
                +{extra}
              </Avatar>
            )}
          </Avatar.Group>
        </Stack>
      </Group>
      {/* Remount when opened so the form picks up the latest trip values. */}
      {editOpen && <EditTripModal trip={trip} opened onClose={() => setEditOpen(false)} />}
    </Card>
  );
}

export function TripPage() {
  const { tripId } = useParams();
  const trip = useTrip(tripId);
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab');
  const tab: TabValue = isTab(rawTab) ? rawTab : 'people';

  if (!trip) {
    return (
      <Center mih="50vh">
        <Stack align="center">
          <Text fw={600}>Trip not found</Text>
          <Button component={Link} to="/" variant="default">
            Back home
          </Button>
        </Stack>
      </Center>
    );
  }

  const setTab = (value: string | null) => {
    if (!isTab(value)) return;
    const next = new URLSearchParams(params);
    next.set('tab', value);
    setParams(next, { replace: true });
  };

  return (
    <Stack gap="md">
      <TripHeader trip={trip} />
      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="people" leftSection={<IconUsers size={16} />}>
            People
            <Badge size="xs" variant="light" ml={6}>
              {trip.members.length}
            </Badge>
          </Tabs.Tab>
          <Tabs.Tab value="logistics" leftSection={<IconCar size={16} />}>
            Cars &amp; beds
          </Tabs.Tab>
          <Tabs.Tab value="expenses" leftSection={<IconReceipt size={16} />}>
            Expenses
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="people" pt="md">
          <PeoplePanel tripId={trip.id} />
        </Tabs.Panel>
        <Tabs.Panel value="logistics" pt="md">
          <LogisticsBoard tripId={trip.id} />
        </Tabs.Panel>
        <Tabs.Panel value="expenses" pt="md">
          <ReceiptsPanel tripId={trip.id} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
