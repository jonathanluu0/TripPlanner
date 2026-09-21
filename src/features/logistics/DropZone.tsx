import type { CSSProperties, ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Group, Stack, Text } from '@mantine/core';

/** Shared visual treatment for a droppable surface, highlighted while something hovers over it. */
export function dropZoneStyle(isOver: boolean): CSSProperties {
  return {
    border: `1.5px dashed ${isOver ? 'var(--mantine-color-teal-5)' : 'var(--mantine-color-default-border)'}`,
    borderRadius: 'var(--mantine-radius-md)',
    backgroundColor: isOver ? 'var(--mantine-color-teal-light)' : 'var(--mantine-color-default-hover)',
    transition: 'background-color 100ms ease, border-color 100ms ease',
  };
}

export interface DropZoneProps {
  id: string;
  label?: ReactNode;
  icon?: ReactNode;
  emptyText: string;
  trailing?: ReactNode;
  children?: ReactNode;
}

/** A dnd-kit droppable container that shows member chips, highlighting while a chip hovers over it. */
export function DropZone({ id, label, icon, emptyText, trailing, children }: DropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const items = children ? (Array.isArray(children) ? children : [children]) : [];
  const hasItems = items.length > 0;

  return (
    <Stack gap={6}>
      {(label || trailing) && (
        <Group justify="space-between" gap={6} wrap="nowrap">
          <Group gap={4} wrap="nowrap">
            {icon}
            {label && (
              <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                {label}
              </Text>
            )}
          </Group>
          {trailing}
        </Group>
      )}
      <Group ref={setNodeRef} gap={6} p={8} wrap="wrap" mih={48} align="center" style={dropZoneStyle(isOver)}>
        {hasItems ? (
          children
        ) : (
          <Text size="xs" c="dimmed">
            {emptyText}
          </Text>
        )}
      </Group>
    </Stack>
  );
}
