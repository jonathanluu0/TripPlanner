import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBed,
  IconCalendar,
  IconCar,
  IconMapPin,
  IconPlus,
  IconReceipt,
  IconTicket,
} from '@tabler/icons-react';
import { useTripStore } from '../store/tripStore';
import { MemberAvatar } from '../components/MemberAvatar';
import { formatDateRange } from '../lib/dates';
import { INVITE_CODE_ALPHABET, normalizeInviteCode } from '../lib/ids';
import type { Trip } from '../types';

function TripCard({ trip }: { trip: Trip }) {
  const dates = formatDateRange(trip.startDate, trip.endDate);
  const shown = trip.members.slice(0, 5);
  const extra = trip.members.length - shown.length;
  return (
    <Card component={Link} to={`/trip/${trip.id}`} padding="lg" style={{ textDecoration: 'none' }}>
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Title order={3} size="h4" lineClamp={1}>
            {trip.name}
          </Title>
          <Badge variant="light" ff="monospace">
            {trip.inviteCode}
          </Badge>
        </Group>
        {trip.destination && (
          <Group gap={4} c="dimmed">
            <IconMapPin size={16} />
            <Text size="sm">{trip.destination}</Text>
          </Group>
        )}
        {dates && (
          <Group gap={4} c="dimmed">
            <IconCalendar size={16} />
            <Text size="sm">{dates}</Text>
          </Group>
        )}
        <Group justify="space-between" mt="sm">
          <Avatar.Group spacing={2}>
            {shown.map((m) => (
              <MemberAvatar key={m.id} member={m} />
            ))}
            {extra > 0 && (
              <Avatar size="sm" radius="xl">
                +{extra}
              </Avatar>
            )}
          </Avatar.Group>
          <Group gap="sm" c="dimmed">
            <Group gap={2}>
              <IconCar size={16} />
              <Text size="xs">{trip.cars.length}</Text>
            </Group>
            <Group gap={2}>
              <IconBed size={16} />
              <Text size="xs">{trip.sleepingSpots.length}</Text>
            </Group>
            <Group gap={2}>
              <IconReceipt size={16} />
              <Text size="xs">{trip.receipts.length}</Text>
            </Group>
          </Group>
        </Group>
      </Stack>
    </Card>
  );
}

function CreateTripModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const createTrip = useTripStore((s) => s.createTrip);
  const setMe = useTripStore((s) => s.setMe);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [yourName, setYourName] = useState('');
  const [range, setRange] = useState<[string | null, string | null]>([null, null]);

  const reset = () => {
    setName('');
    setDestination('');
    setYourName('');
    setRange([null, null]);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const trip = createTrip({
      name,
      destination,
      startDate: range[0] ?? undefined,
      endDate: range[1] ?? range[0] ?? undefined,
      memberNames: yourName.trim() ? [yourName] : [],
    });
    // The creator is the first member, so remember them as "me" on this device.
    if (trip.members[0]) setMe(trip.id, trip.members[0].id);
    reset();
    onClose();
    navigate(`/trip/${trip.id}?tab=people`);
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Create a trip" centered>
      <form onSubmit={submit}>
        <Stack>
          <TextInput
            label="Trip name"
            placeholder="Tahoe Weekend"
            required
            data-autofocus
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <TextInput
            label="Destination"
            placeholder="South Lake Tahoe, CA"
            leftSection={<IconMapPin size={16} />}
            value={destination}
            onChange={(e) => setDestination(e.currentTarget.value)}
          />
          <DatePickerInput
            type="range"
            label="Dates"
            placeholder="Pick dates"
            leftSection={<IconCalendar size={16} />}
            clearable
            allowSingleDateInRange
            value={range}
            onChange={(v) => setRange([v[0] ?? null, v[1] ?? null])}
          />
          <TextInput
            label="Your name"
            description="You'll be added as the first attendee"
            placeholder="Jon"
            value={yourName}
            onChange={(e) => setYourName(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create trip
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function JoinWithCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const normalized = normalizeInviteCode(code);
  const valid = normalized.length === 6 && [...normalized].every((c) => INVITE_CODE_ALPHABET.includes(c));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) navigate(`/join/${normalized}`);
      }}
    >
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <TextInput
          aria-label="Invite code"
          placeholder="Invite code"
          leftSection={<IconTicket size={16} />}
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.currentTarget.value.toUpperCase())}
          styles={{ input: { fontFamily: 'monospace', letterSpacing: 2 } }}
          w={170}
        />
        <Button type="submit" variant="light" disabled={!valid}>
          Join
        </Button>
      </Group>
    </form>
  );
}

export function HomePage() {
  const tripsMap = useTripStore((s) => s.trips);
  const demoSeeded = useTripStore((s) => s.demoSeeded);
  const seedDemoTrip = useTripStore((s) => s.seedDemoTrip);
  const [createOpened, createHandlers] = useDisclosure(false);

  const trips = useMemo(
    () => Object.values(tripsMap).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [tripsMap],
  );

  // First run: seed a demo trip so the app isn't empty.
  useEffect(() => {
    if (trips.length === 0 && !demoSeeded) seedDemoTrip();
  }, [trips.length, demoSeeded, seedDemoTrip]);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={1}>Your trips</Title>
          <Text c="dimmed">Cars, beds and who owes what, all in one place.</Text>
        </div>
        <Group gap="sm" align="flex-start">
          <JoinWithCode />
          <Button leftSection={<IconPlus size={18} />} onClick={createHandlers.open}>
            Create trip
          </Button>
        </Group>
      </Group>

      {trips.length === 0 ? (
        <Card padding="xl">
          <Stack align="center" gap="sm">
            <Text fw={600}>No trips yet</Text>
            <Text c="dimmed" size="sm" ta="center">
              Create a trip and share the invite code with your friends.
            </Text>
            <Group>
              <Button onClick={createHandlers.open}>Create trip</Button>
              <Button variant="default" onClick={() => seedDemoTrip()}>
                Load demo trip
              </Button>
            </Group>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {trips.map((t) => (
            <TripCard key={t.id} trip={t} />
          ))}
        </SimpleGrid>
      )}

      <CreateTripModal opened={createOpened} onClose={createHandlers.close} />
    </Stack>
  );
}
