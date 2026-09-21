import { useDroppable } from '@dnd-kit/core';
import { useMediaQuery } from '@mantine/hooks';
import { Badge, Group, Paper, ScrollArea, Stack, Text, Tooltip } from '@mantine/core';
import { IconBed, IconCar, IconUsers } from '@tabler/icons-react';
import type { Trip } from '../../types';
import { DraggableMemberChip } from './DraggableMemberChip';
import { dropZoneStyle } from './DropZone';
import { DESKTOP_QUERY, memberDraggableId, POOL_ID } from './dnd';

/**
 * Every trip member as a draggable chip, and itself a drop target meaning "unassign" (from
 * whichever kind of container — car or bed — the chip was dragged out of). Sticky sidebar on
 * desktop, horizontally scrolling strip on mobile.
 */
export function AttendeePool({ trip }: { trip: Trip }) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_ID });
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  const missingCar = (memberId: string) =>
    !trip.cars.some((c) => c.driverIds.includes(memberId) || c.passengerIds.includes(memberId));
  const missingSpot = (memberId: string) => !trip.sleepingSpots.some((s) => s.occupantIds.includes(memberId));

  const chips = trip.members.map((m) => {
    const noCar = missingCar(m.id);
    const noSpot = missingSpot(m.id);
    const badge =
      noCar || noSpot ? (
        <Group gap={3} wrap="nowrap">
          {noCar && (
            <Tooltip label="Not in a car" withArrow>
              <IconCar size={12} stroke={2.5} style={{ opacity: 0.55, flexShrink: 0 }} />
            </Tooltip>
          )}
          {noSpot && (
            <Tooltip label="No bed yet" withArrow>
              <IconBed size={12} stroke={2.5} style={{ opacity: 0.55, flexShrink: 0 }} />
            </Tooltip>
          )}
        </Group>
      ) : undefined;
    return <DraggableMemberChip key={m.id} member={m} draggableId={memberDraggableId(m.id, POOL_ID)} badge={badge} />;
  });

  const emptyText = (
    <Text size="sm" c="dimmed">
      No attendees yet — add names on the People tab.
    </Text>
  );

  return (
    <Paper p="md" withBorder>
      <Stack gap="sm">
        <Group gap={6}>
          <IconUsers size={16} />
          <Text fw={600} size="sm">
            Attendees
          </Text>
          <Badge variant="light" size="sm">
            {trip.members.length}
          </Badge>
        </Group>

        {isDesktop ? (
          <Stack ref={setNodeRef} gap={8} p={8} mih={80} style={dropZoneStyle(isOver)}>
            {trip.members.length === 0 ? emptyText : chips}
          </Stack>
        ) : (
          <ScrollArea type="auto" offsetScrollbars scrollbarSize={6}>
            <Group ref={setNodeRef} gap={8} p={8} wrap="nowrap" mih={56} style={dropZoneStyle(isOver)}>
              {trip.members.length === 0 ? emptyText : chips}
            </Group>
          </ScrollArea>
        )}
      </Stack>
    </Paper>
  );
}
