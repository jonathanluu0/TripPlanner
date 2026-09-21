import { useState, type FormEvent } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  CopyButton,
  Grid,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  IconBed,
  IconCar,
  IconCheck,
  IconCopy,
  IconPencil,
  IconTrash,
  IconUserCheck,
  IconUserPlus,
  IconX,
} from '@tabler/icons-react';
import { useTrip, useTripStore } from '../../store/tripStore';
import { MemberAvatar } from '../../components/MemberAvatar';
import { inviteLink } from '../../lib/dates';
import type { Member, Trip } from '../../types';

function MemberRow({ trip, member, isMe }: { trip: Trip; member: Member; isMe: boolean }) {
  const renameMember = useTripStore((s) => s.renameMember);
  const removeMember = useTripStore((s) => s.removeMember);
  const setMe = useTripStore((s) => s.setMe);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(member.name);

  const car = trip.cars.find((c) => c.driverIds.includes(member.id) || c.passengerIds.includes(member.id));
  const isDriver = !!car?.driverIds.includes(member.id);
  const spot = trip.sleepingSpots.find((s) => s.occupantIds.includes(member.id));

  const save = (e?: FormEvent) => {
    e?.preventDefault();
    if (draft.trim()) renameMember(trip.id, member.id, draft);
    else setDraft(member.name);
    setEditing(false);
  };

  const confirmRemove = () =>
    modals.openConfirmModal({
      title: `Remove ${member.name}?`,
      children: (
        <Text size="sm">
          They'll also be taken out of any car, sleeping spot and receipt split. Receipts they paid for will
          have no payer.
        </Text>
      ),
      labels: { confirm: 'Remove', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => removeMember(trip.id, member.id),
    });

  return (
    <Group justify="space-between" wrap="nowrap" py={6}>
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
        <MemberAvatar member={member} size="md" />
        {editing ? (
          <form onSubmit={save} style={{ flex: 1 }}>
            <Group gap={4} wrap="nowrap">
              <TextInput
                size="xs"
                autoFocus
                aria-label="Name"
                value={draft}
                onChange={(e) => setDraft(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setDraft(member.name);
                    setEditing(false);
                  }
                }}
                style={{ flex: 1 }}
              />
              <ActionIcon type="submit" variant="light" aria-label="Save name">
                <IconCheck size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label="Cancel"
                onClick={() => {
                  setDraft(member.name);
                  setEditing(false);
                }}
              >
                <IconX size={16} />
              </ActionIcon>
            </Group>
          </form>
        ) : (
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Group gap={6} wrap="nowrap">
              <Text fw={500} truncate>
                {member.name}
              </Text>
              {isMe && (
                <Badge size="xs" variant="light">
                  you
                </Badge>
              )}
            </Group>
            <Group gap={6}>
              <Badge
                size="xs"
                variant={car ? 'light' : 'outline'}
                color={car ? 'blue' : 'gray'}
                leftSection={<IconCar size={10} />}
              >
                {car ? `${car.label}${isDriver ? ' · driver' : ''}` : 'No car'}
              </Badge>
              <Badge
                size="xs"
                variant={spot ? 'light' : 'outline'}
                color={spot ? 'grape' : 'gray'}
                leftSection={<IconBed size={10} />}
              >
                {spot ? spot.label : 'No bed'}
              </Badge>
            </Group>
          </Stack>
        )}
      </Group>
      {!editing && (
        <Group gap={4} wrap="nowrap">
          {!isMe && (
            <Tooltip label="This is me">
              <ActionIcon variant="subtle" color="gray" aria-label="This is me" onClick={() => setMe(trip.id, member.id)}>
                <IconUserCheck size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="Rename">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={`Rename ${member.name}`}
              onClick={() => {
                setDraft(member.name);
                setEditing(true);
              }}
            >
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Remove">
            <ActionIcon variant="subtle" color="red" aria-label={`Remove ${member.name}`} onClick={confirmRemove}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      )}
    </Group>
  );
}

function InviteCard({ trip }: { trip: Trip }) {
  const link = inviteLink(trip.inviteCode);
  return (
    <Card padding="lg">
      <Stack gap="sm">
        <Title order={4}>Invite friends</Title>
        <Text size="sm" c="dimmed">
          Share the link or code. Friends can claim a name you've already added or join as someone new.
        </Text>
        <Text ff="monospace" fz={32} fw={700} ta="center" style={{ letterSpacing: 6 }}>
          {trip.inviteCode}
        </Text>
        <TextInput
          readOnly
          value={link}
          aria-label="Invite link"
          onFocus={(e) => e.currentTarget.select()}
          rightSectionWidth={40}
          rightSection={
            <CopyButton value={link} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copied' : 'Copy link'} withArrow>
                  <ActionIcon variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy} aria-label="Copy link">
                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          }
        />
        <CopyButton value={trip.inviteCode} timeout={2000}>
          {({ copied, copy }) => (
            <Button variant="light" onClick={copy} leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}>
              {copied ? 'Code copied' : 'Copy code'}
            </Button>
          )}
        </CopyButton>
      </Stack>
    </Card>
  );
}

/** Attendees tab: add / rename / remove members and share the invite. */
export function PeoplePanel({ tripId }: { tripId: string }) {
  const trip = useTrip(tripId);
  const meId = useTripStore((s) => s.meByTrip[tripId]);
  const addMember = useTripStore((s) => s.addMember);
  const [name, setName] = useState('');

  if (!trip) return null;

  const duplicate = trip.members.some((m) => m.name.toLowerCase() === name.trim().toLowerCase());

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || duplicate) return;
    addMember(trip.id, name);
    setName('');
  };

  return (
    <Grid gutter="md">
      <Grid.Col span={{ base: 12, md: 7 }}>
        <Card padding="lg">
          <Stack gap="sm">
            <Group justify="space-between">
              <Title order={4}>Attendees</Title>
              <Badge variant="light">{trip.members.length} going</Badge>
            </Group>
            <form onSubmit={add}>
              <Group gap="xs" wrap="nowrap" align="flex-start">
                <TextInput
                  placeholder="Add a name, e.g. Alex"
                  aria-label="New attendee name"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  error={duplicate ? 'Someone with that name is already on the trip' : undefined}
                  style={{ flex: 1 }}
                />
                <Button type="submit" leftSection={<IconUserPlus size={18} />} disabled={!name.trim() || duplicate}>
                  Add
                </Button>
              </Group>
            </form>
            {trip.members.length === 0 ? (
              <Text c="dimmed" size="sm" ta="center" py="lg">
                No one yet. Add names above or share the invite link.
              </Text>
            ) : (
              <Stack gap={0}>
                {trip.members.map((m) => (
                  <MemberRow key={m.id} trip={trip} member={m} isMe={m.id === meId} />
                ))}
              </Stack>
            )}
          </Stack>
        </Card>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 5 }}>
        <InviteCard trip={trip} />
      </Grid.Col>
    </Grid>
  );
}
