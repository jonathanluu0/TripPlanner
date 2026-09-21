import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { CloseButton, Group, Paper, Text } from '@mantine/core';
import type { Member } from '../types';
import { MemberAvatar } from './MemberAvatar';

export interface MemberChipProps extends HTMLAttributes<HTMLDivElement> {
  member: Pick<Member, 'id' | 'name' | 'color'>;
  /** When provided, renders an ✕ button. */
  onRemove?: () => void;
  /** Small trailing content, e.g. a "needs car" badge. */
  badge?: ReactNode;
  /** Visual state while being dragged (dnd-kit `isDragging`). */
  dragging?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Presentational pill: avatar + name (+ optional badge and remove button).
 * Forwards its ref and spreads extra props onto the root so dnd-kit can attach
 * `setNodeRef`, `listeners`, `attributes` and `style`:
 *
 *   <MemberChip ref={setNodeRef} member={m} style={style} {...listeners} {...attributes} />
 */
export const MemberChip = forwardRef<HTMLDivElement, MemberChipProps>(function MemberChip(
  { member, onRemove, badge, dragging = false, size = 'sm', style, ...rest },
  ref,
) {
  return (
    <Paper
      ref={ref}
      withBorder
      radius="xl"
      py={4}
      pl={4}
      pr={onRemove ? 4 : 12}
      shadow={dragging ? 'md' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        opacity: dragging ? 0.85 : 1,
        userSelect: 'none',
        touchAction: 'none',
        maxWidth: '100%',
        ...style,
      }}
      data-member-id={member.id}
      {...rest}
    >
      <Group gap={6} wrap="nowrap">
        <MemberAvatar member={member} size={size === 'md' ? 28 : 22} />
        <Text size={size} fw={500} truncate>
          {member.name}
        </Text>
        {badge}
        {onRemove && (
          <CloseButton
            size="sm"
            radius="xl"
            aria-label={`Remove ${member.name}`}
            // Keep clicks on ✕ from starting a drag.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          />
        )}
      </Group>
    </Paper>
  );
});
