import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Center,
  Divider,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconUserPlus } from '@tabler/icons-react';
import { useTripStore } from '../store/tripStore';
import { repository } from '../backend';
import { normalizeInviteCode } from '../lib/ids';
import { formatDateRange } from '../lib/dates';
import { MemberChip } from '../components/MemberChip';
import type { Member } from '../types';

/**
 * /join/:code — resolve an invite code, then either claim an existing
 * placeholder member ("I'm Alex") or add yourself as a new member.
 */
export function JoinPage() {
  const { code: rawCode = '' } = useParams();
  const code = normalizeInviteCode(rawCode);
  const navigate = useNavigate();

  const trip = useTripStore((s) => Object.values(s.trips).find((t) => t.inviteCode === code));
  const meId = useTripStore((s) => (trip ? s.meByTrip[trip.id] : undefined));
  const upsertTrip = useTripStore((s) => s.upsertTrip);
  const joinTripByCode = useTripStore((s) => s.joinTripByCode);
  const setMe = useTripStore((s) => s.setMe);

  const [lookingUp, setLookingUp] = useState(!trip);
  const [name, setName] = useState('');

  // Not in the local store: ask the repository (remote backend / other tab).
  useEffect(() => {
    if (trip) {
      setLookingUp(false);
      return;
    }
    let cancelled = false;
    setLookingUp(true);
    repository
      .findTripByInviteCode(code)
      .then((found) => {
        if (!cancelled && found) upsertTrip(found);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLookingUp(false));
    return () => {
      cancelled = true;
    };
  }, [code, trip, upsertTrip]);

  if (!trip) {
    return (
      <Center mih="50vh">
        {lookingUp ? (
          <Loader />
        ) : (
          <Card maw={440} padding="xl">
            <Stack>
              <Alert color="red" icon={<IconAlertCircle />} title="Trip not found">
                No trip matches code <b>{code || '—'}</b>. With the local backend, trips only exist on the
                device that created them — connect a shared backend (see docs) to join from other devices.
              </Alert>
              <Button component={Link} to="/" variant="default">
                Back home
              </Button>
            </Stack>
          </Card>
        )}
      </Center>
    );
  }

  const me = trip.members.find((m) => m.id === meId);
  const goToTrip = () => navigate(`/trip/${trip.id}`);

  const claim = (member: Member) => {
    setMe(trip.id, member.id);
    notifications.show({ color: 'teal', message: `Welcome, ${member.name}!` });
    goToTrip();
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    const result = joinTripByCode(code, name);
    if (!result) return;
    notifications.show({ color: 'teal', message: `You joined ${result.trip.name}` });
    goToTrip();
  };

  const dates = formatDateRange(trip.startDate, trip.endDate);

  return (
    <Center mih="60vh">
      <Card maw={520} w="100%" padding="xl">
        <Stack>
          <div>
            <Text c="dimmed" size="sm">
              You're invited to
            </Text>
            <Title order={2}>{trip.name}</Title>
            {(trip.destination || dates) && (
              <Text c="dimmed">{[trip.destination, dates].filter(Boolean).join(' · ')}</Text>
            )}
          </div>

          {me && (
            <Alert color="teal" title={`You're already in as ${me.name}`}>
              <Button mt="xs" size="xs" onClick={goToTrip}>
                Open trip
              </Button>
            </Alert>
          )}

          {trip.members.length > 0 && (
            <>
              <Text fw={600}>Are you one of these people?</Text>
              <Group gap="xs">
                {trip.members.map((m) => (
                  <MemberChip
                    key={m.id}
                    member={m}
                    size="md"
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                    onClick={() => claim(m)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && claim(m)}
                    title={`I'm ${m.name}`}
                  />
                ))}
              </Group>
              <Divider label="or" labelPosition="center" />
            </>
          )}

          <form onSubmit={join}>
            <Group align="flex-end" wrap="nowrap">
              <TextInput
                label="Join as a new person"
                placeholder="Your name"
                style={{ flex: 1 }}
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
              />
              <Button type="submit" leftSection={<IconUserPlus size={18} />} disabled={!name.trim()}>
                Join
              </Button>
            </Group>
          </form>
        </Stack>
      </Card>
    </Center>
  );
}
