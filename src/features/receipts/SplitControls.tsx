import { Group, MultiSelect, NumberInput, Select, Stack, Text } from '@mantine/core';
import { IconUsers, IconUserDollar } from '@tabler/icons-react';
import type { Receipt, Trip } from '../../types';
import { useTripStore } from '../../store/tripStore';
import { splitParticipants } from '../../lib/settle';
import { splitEven, formatCents } from '../../lib/money';

/** "$23.34 each" or "$23.34 each, 1 person pays +$0.01" when cents don't divide evenly. */
function describeSplit(shares: number[]): string {
  if (shares.length === 0) return 'Pick who this is split between';
  const lower = Math.min(...shares);
  const higher = Math.max(...shares);
  const base = `${formatCents(lower)} each`;
  if (higher === lower) return base;
  const extraCount = shares.filter((s) => s === higher).length;
  return `${base}, ${extraCount} ${extraCount === 1 ? 'person pays' : 'people pay'} +${formatCents(higher - lower)}`;
}

export interface SplitControlsProps {
  trip: Trip;
  receipt: Receipt;
  /** Compact layout for the receipt card; full layout (with labels) in the review modal. */
  compact?: boolean;
}

/** Split-evenly controls + "who fronted this" — Feature 2 (docs/DESIGN.md §4). */
export function SplitControls({ trip, receipt, compact = false }: SplitControlsProps) {
  const updateReceipt = useTripStore((s) => s.updateReceipt);

  const memberOptions = trip.members.map((m) => ({ value: m.id, label: m.name }));
  const participants = splitParticipants(trip, receipt);
  const shares = splitEven(receipt.total, participants.length);
  const explicit = receipt.split.participantIds.filter((id) => trip.members.some((m) => m.id === id));
  const effectiveCount = explicit.length > 0 ? explicit.length : receipt.split.count;

  const setCount = (n: number) => {
    const count = Math.max(1, Math.min(Math.round(n), Math.max(trip.members.length, 1)));
    updateReceipt(trip.id, receipt.id, { split: { mode: 'even', count, participantIds: [] } });
  };

  const setParticipants = (ids: string[]) => {
    updateReceipt(trip.id, receipt.id, {
      split: { mode: 'even', count: Math.max(ids.length, 1), participantIds: ids },
    });
  };

  const setPaidBy = (id: string | null) => {
    updateReceipt(trip.id, receipt.id, { paidById: id ?? undefined });
  };

  return (
    <Stack gap={compact ? 6 : 'sm'}>
      <Group gap="sm" wrap="wrap" align="flex-end">
        <NumberInput
          label={compact ? undefined : 'Split evenly between'}
          aria-label="Split evenly between how many people"
          leftSection={<IconUsers size={16} />}
          min={1}
          max={Math.max(trip.members.length, 1)}
          value={effectiveCount}
          onChange={(v) => setCount(typeof v === 'number' ? v : Number.parseInt(v, 10) || 1)}
          suffix=" people"
          w={compact ? 130 : 160}
          size={compact ? 'xs' : 'sm'}
        />
        <MultiSelect
          label={compact ? undefined : 'Who’s splitting it (optional)'}
          placeholder="First N members"
          data={memberOptions}
          value={explicit}
          onChange={setParticipants}
          clearable
          searchable
          size={compact ? 'xs' : 'sm'}
          style={{ flex: 1, minWidth: 160 }}
        />
        <Select
          label={compact ? undefined : 'Who fronted this bill?'}
          placeholder="Payer"
          leftSection={<IconUserDollar size={16} />}
          data={memberOptions}
          value={receipt.paidById ?? null}
          onChange={setPaidBy}
          clearable
          searchable
          size={compact ? 'xs' : 'sm'}
          w={compact ? 160 : 200}
        />
      </Group>
      <Text size={compact ? 'xs' : 'sm'} c="dimmed">
        {describeSplit(shares)}
      </Text>
    </Stack>
  );
}
