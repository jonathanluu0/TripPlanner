import { useState } from 'react';
import { Button, Grid, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { IconPlus } from '@tabler/icons-react';
import { useTrip, useTripStore } from '../../store/tripStore';
import { MemberChip } from '../../components/MemberChip';
import type { Member } from '../../types';
import { AttendeePool } from './AttendeePool';
import { CarCard } from './CarCard';
import { SleepingCard } from './SleepingCard';
import { DESKTOP_QUERY, parseContainerId, parseMemberDraggableId } from './dnd';

/**
 * Feature 1 — cars & sleeping arrangements (docs/DESIGN.md §4). One DndContext hosts the
 * attendee pool plus every car / sleeping-spot drop zone; dragging a chip onto a zone assigns
 * it, dragging it back onto the pool unassigns it from whichever kind of container it came from.
 */
export function LogisticsBoard({ tripId }: { tripId: string }) {
  const trip = useTrip(tripId);
  const addCar = useTripStore((s) => s.addCar);
  const addSleepingSpot = useTripStore((s) => s.addSleepingSpot);
  const assignToCar = useTripStore((s) => s.assignToCar);
  const assignToSpot = useTripStore((s) => s.assignToSpot);
  const unassignFromCars = useTripStore((s) => s.unassignFromCars);
  const unassignFromSpots = useTripStore((s) => s.unassignFromSpots);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  const [activeMember, setActiveMember] = useState<Member | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  if (!trip) return null;

  const membersById = new Map(trip.members.map((m) => [m.id, m]));

  const handleDragStart = (event: DragStartEvent) => {
    const parsed = parseMemberDraggableId(String(event.active.id));
    setActiveMember(parsed ? (membersById.get(parsed.memberId) ?? null) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveMember(null);
    const { active, over } = event;
    if (!over) return;
    const parsed = parseMemberDraggableId(String(active.id));
    if (!parsed) return;
    const { memberId, fromContainerId } = parsed;
    const toContainerId = String(over.id);
    if (toContainerId === fromContainerId) return;

    const from = parseContainerId(fromContainerId);
    const to = parseContainerId(toContainerId);

    if (to.type === 'pool') {
      if (from.type === 'car') unassignFromCars(trip.id, memberId);
      else if (from.type === 'spot') unassignFromSpots(trip.id, memberId);
      return;
    }
    if (to.type === 'car') {
      assignToCar(trip.id, memberId, to.carId, to.role);
      return;
    }
    assignToSpot(trip.id, memberId, to.spotId);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveMember(null)}
    >
      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, md: 3 }} style={isDesktop ? { position: 'sticky', top: 16 } : undefined}>
          <AttendeePool trip={trip} />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 9 }}>
          <Stack gap="xl">
            <Stack gap="sm">
              <Group justify="space-between">
                <Title order={4}>Cars</Title>
                <Button size="xs" leftSection={<IconPlus size={14} />} variant="light" onClick={() => addCar(trip.id)}>
                  Add car
                </Button>
              </Group>
              {trip.cars.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No cars yet. Add one to start assigning drivers and riders.
                </Text>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="md">
                  {trip.cars.map((car) => (
                    <CarCard key={car.id} trip={trip} car={car} />
                  ))}
                </SimpleGrid>
              )}
            </Stack>

            <Stack gap="sm">
              <Group justify="space-between">
                <Title order={4}>Sleeping arrangements</Title>
                <Button
                  size="xs"
                  leftSection={<IconPlus size={14} />}
                  variant="light"
                  onClick={() => addSleepingSpot(trip.id)}
                >
                  Add sleeping spot
                </Button>
              </Group>
              {trip.sleepingSpots.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No sleeping spots yet. Add bedrooms, couches, or airbeds.
                </Text>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="md">
                  {trip.sleepingSpots.map((spot) => (
                    <SleepingCard key={spot.id} trip={trip} spot={spot} />
                  ))}
                </SimpleGrid>
              )}
            </Stack>
          </Stack>
        </Grid.Col>
      </Grid>

      <DragOverlay>{activeMember ? <MemberChip member={activeMember} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}
