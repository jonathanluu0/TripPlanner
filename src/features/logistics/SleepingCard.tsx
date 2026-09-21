import { useState } from 'react';
import { ActionIcon, Badge, Card, Group, NumberInput, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconBed, IconBedFlat, IconHome2, IconSofa, IconTrash, IconUsers } from '@tabler/icons-react';
import { useTripStore } from '../../store/tripStore';
import { SLEEPING_KINDS, type Member, type SleepingKind, type SleepingSpot, type Trip } from '../../types';
import { DraggableMemberChip } from './DraggableMemberChip';
import { DropZone } from './DropZone';
import { NameAssignInput } from './NameAssignInput';
import { memberDraggableId, spotContainerId } from './dnd';

const KIND_ICON = {
  Bedroom: IconBed,
  Couch: IconSofa,
  Airbed: IconBedFlat,
  Other: IconHome2,
} as const satisfies Record<SleepingKind, typeof IconBed>;

export function SleepingCard({ trip, spot }: { trip: Trip; spot: SleepingSpot }) {
  const updateSleepingSpot = useTripStore((s) => s.updateSleepingSpot);
  const removeSleepingSpot = useTripStore((s) => s.removeSleepingSpot);
  const assignToSpot = useTripStore((s) => s.assignToSpot);
  const unassignFromSpots = useTripStore((s) => s.unassignFromSpots);
  const [label, setLabel] = useState(spot.label);

  const byId = new Map(trip.members.map((m) => [m.id, m]));
  const occupants: Member[] = spot.occupantIds.map((id) => byId.get(id)).filter((m): m is Member => !!m);
  const over = occupants.length > spot.capacity;
  const Icon = KIND_ICON[spot.kind];

  const commitLabel = () => {
    const trimmed = label.trim();
    if (trimmed && trimmed !== spot.label) updateSleepingSpot(trip.id, spot.id, { label: trimmed });
    else if (!trimmed) setLabel(spot.label);
  };

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: `Delete ${spot.label}?`,
      children: <Text size="sm">Anyone sleeping here will be unassigned. This can't be undone.</Text>,
      labels: { confirm: 'Delete spot', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => removeSleepingSpot(trip.id, spot.id),
    });

  const zone = spotContainerId(spot.id);

  return (
    <Card padding="lg">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="center">
          <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Icon size={18} style={{ flexShrink: 0 }} />
            <TextInput
              variant="unstyled"
              value={label}
              onChange={(e) => setLabel(e.currentTarget.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              aria-label="Sleeping spot label"
              style={{ flex: 1 }}
              styles={{ input: { fontWeight: 600, paddingLeft: 0, minHeight: 'auto' } }}
            />
          </Group>
          <Tooltip label="Delete spot" withArrow>
            <ActionIcon variant="subtle" color="red" onClick={confirmDelete} aria-label={`Delete ${spot.label}`}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Group gap="xs" align="flex-end">
          <Select
            label="Kind"
            data={SLEEPING_KINDS}
            value={spot.kind}
            onChange={(v) => v && updateSleepingSpot(trip.id, spot.id, { kind: v as SleepingKind })}
            allowDeselect={false}
            size="xs"
            w={130}
          />
          <NumberInput
            label="Capacity"
            min={1}
            max={12}
            value={spot.capacity}
            onChange={(v) => updateSleepingSpot(trip.id, spot.id, { capacity: typeof v === 'number' ? v : spot.capacity })}
            size="xs"
            w={90}
          />
          <Badge color={over ? 'red' : 'gray'} variant={over ? 'filled' : 'light'} mb={4}>
            {occupants.length} / {spot.capacity}
          </Badge>
        </Group>

        <DropZone id={zone} label="Occupants" icon={<IconUsers size={14} />} emptyText="Drop occupants here">
          {occupants.map((m) => (
            <DraggableMemberChip
              key={m.id}
              member={m}
              draggableId={memberDraggableId(m.id, zone)}
              onRemove={() => unassignFromSpots(trip.id, m.id)}
            />
          ))}
        </DropZone>
        <NameAssignInput
          tripId={trip.id}
          members={trip.members}
          placeholder="Add occupant…"
          onAssign={(id) => assignToSpot(trip.id, id, spot.id)}
        />
      </Stack>
    </Card>
  );
}
