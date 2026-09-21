import { Alert, Badge, Card, Group, Stack, Text, Title } from '@mantine/core';
import { IconArrowRight, IconScale } from '@tabler/icons-react';
import type { Trip } from '../../types';
import { computeBalances, settleUp } from '../../lib/settle';
import { formatCents } from '../../lib/money';
import { membersById } from '../../store/tripStore';
import { MemberAvatar } from '../../components/MemberAvatar';

export interface BalancesCardProps {
  trip: Trip;
}

/** Net balances + minimal settle-up list — Feature 2 footer (docs/DESIGN.md §4). */
export function BalancesCard({ trip }: BalancesCardProps) {
  const balances = computeBalances(trip);
  const settlements = settleUp(balances);
  const byId = membersById(trip);
  const unconfirmedCount = trip.receipts.filter((r) => r.status !== 'confirmed').length;

  return (
    <Card padding="lg">
      <Stack gap="sm">
        <Group gap="xs">
          <IconScale size={18} />
          <Title order={4}>Balances</Title>
        </Group>

        {trip.members.length === 0 ? (
          <Text size="sm" c="dimmed">
            Add attendees to start tracking balances.
          </Text>
        ) : (
          <Stack gap={6}>
            {trip.members.map((m) => {
              const amount = balances[m.id] ?? 0;
              return (
                <Group key={m.id} justify="space-between">
                  <Group gap="xs">
                    <MemberAvatar member={m} size="sm" />
                    <Text size="sm">{m.name}</Text>
                  </Group>
                  <Text size="sm" fw={600} c={amount > 0 ? 'teal' : amount < 0 ? 'red' : 'dimmed'}>
                    {amount === 0 ? 'settled up' : `${amount > 0 ? '+' : ''}${formatCents(amount)}`}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        )}

        {settlements.length > 0 && (
          <Stack gap={6}>
            <Text size="sm" fw={500}>
              Who pays whom
            </Text>
            {settlements.map((s, i) => (
              <Group key={i} gap={6} wrap="nowrap">
                <Badge variant="light" color="gray">
                  {byId[s.from]?.name ?? 'Someone'}
                </Badge>
                <IconArrowRight size={14} />
                <Badge variant="light" color="teal">
                  {byId[s.to]?.name ?? 'Someone'}
                </Badge>
                <Text size="sm" fw={600} c="orange">
                  {formatCents(s.amount)}
                </Text>
              </Group>
            ))}
          </Stack>
        )}

        {unconfirmedCount > 0 && (
          <Alert color="gray" variant="light" py={6}>
            <Text size="xs" c="dimmed">
              {unconfirmedCount} receipt{unconfirmedCount === 1 ? '' : 's'} still {unconfirmedCount === 1 ? 'needs' : 'need'} review and{' '}
              {unconfirmedCount === 1 ? "isn't" : "aren't"} counted above.
            </Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
