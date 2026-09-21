import { useState } from 'react';
import { ActionIcon, Badge, Card, Group, NumberInput, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconCar, IconSteeringWheel, IconTrash, IconUsers } from '@tabler/icons-react';
import { useTripStore } from '../../store/tripStore';
import type { Car, Member, Trip } from '../../types';
import { DraggableMemberChip } from './DraggableMemberChip';
import { DropZone } from './DropZone';
import { NameAssignInput } from './NameAssignInput';
import { carContainerId, memberDraggableId } from './dnd';

export function CarCard({ trip, car }: { trip: Trip; car: Car }) {
  const updateCar = useTripStore((s) => s.updateCar);
  const removeCar = useTripStore((s) => s.removeCar);
  const assignToCar = useTripStore((s) => s.assignToCar);
  const unassignFromCars = useTripStore((s) => s.unassignFromCars);
  const [label, setLabel] = useState(car.label);

  const byId = new Map(trip.members.map((m) => [m.id, m]));
  const pick = (ids: string[]): Member[] => ids.map((id) => byId.get(id)).filter((m): m is Member => !!m);
  const drivers = pick(car.driverIds);
  const passengers = pick(car.passengerIds);
  const total = drivers.length + passengers.length;
  const over = total > car.seats;

  const commitLabel = () => {
    const trimmed = label.trim();
    if (trimmed && trimmed !== car.label) updateCar(trip.id, car.id, { label: trimmed });
    else if (!trimmed) setLabel(car.label);
  };

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: `Delete ${car.label}?`,
      children: <Text size="sm">Anyone riding in this car will be unassigned. This can't be undone.</Text>,
      labels: { confirm: 'Delete car', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => removeCar(trip.id, car.id),
    });

  const driverZone = carContainerId(car.id, 'driver');
  const passengerZone = carContainerId(car.id, 'passenger');

  return (
    <Card padding="lg">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="center">
          <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <IconCar size={18} style={{ flexShrink: 0 }} />
            <TextInput
              variant="unstyled"
              value={label}
              onChange={(e) => setLabel(e.currentTarget.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              aria-label="Car label"
              style={{ flex: 1 }}
              styles={{ input: { fontWeight: 600, paddingLeft: 0, minHeight: 'auto' } }}
            />
          </Group>
          <Tooltip label="Delete car" withArrow>
            <ActionIcon variant="subtle" color="red" onClick={confirmDelete} aria-label={`Delete ${car.label}`}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Group gap="xs" align="flex-end">
          <NumberInput
            label="Seats"
            min={1}
            max={20}
            value={car.seats}
            onChange={(v) => updateCar(trip.id, car.id, { seats: typeof v === 'number' ? v : car.seats })}
            size="xs"
            w={90}
          />
          <Badge color={over ? 'red' : 'gray'} variant={over ? 'filled' : 'light'} mb={4}>
            {total} / {car.seats}
          </Badge>
        </Group>

        <DropZone id={driverZone} label="Driver(s)" icon={<IconSteeringWheel size={14} />} emptyText="Drop a driver here">
          {drivers.map((m) => (
            <DraggableMemberChip
              key={m.id}
              member={m}
              draggableId={memberDraggableId(m.id, driverZone)}
              onRemove={() => unassignFromCars(trip.id, m.id)}
            />
          ))}
        </DropZone>
        <NameAssignInput
          tripId={trip.id}
          members={trip.members}
          placeholder="Add driver…"
          onAssign={(id) => assignToCar(trip.id, id, car.id, 'driver')}
        />

        <DropZone id={passengerZone} label="Passengers" icon={<IconUsers size={14} />} emptyText="Drop passengers here">
          {passengers.map((m) => (
            <DraggableMemberChip
              key={m.id}
              member={m}
              draggableId={memberDraggableId(m.id, passengerZone)}
              onRemove={() => unassignFromCars(trip.id, m.id)}
            />
          ))}
        </DropZone>
        <NameAssignInput
          tripId={trip.id}
          members={trip.members}
          placeholder="Add passenger…"
          onAssign={(id) => assignToCar(trip.id, id, car.id, 'passenger')}
        />
      </Stack>
    </Card>
  );
}
