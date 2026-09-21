import type { ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { MemberChip } from '../../components/MemberChip';
import type { Member } from '../../types';

export interface DraggableMemberChipProps {
  member: Pick<Member, 'id' | 'name' | 'color'>;
  /** Full draggable id, see `memberDraggableId`. */
  draggableId: string;
  onRemove?: () => void;
  badge?: ReactNode;
  size?: 'sm' | 'md';
}

/** A `MemberChip` wired up as a dnd-kit draggable. */
export function DraggableMemberChip({ member, draggableId, onRemove, badge, size }: DraggableMemberChipProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: { member },
  });

  return (
    <MemberChip
      ref={setNodeRef}
      member={member}
      onRemove={onRemove}
      badge={badge}
      size={size}
      dragging={isDragging}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 1 } : undefined}
      {...listeners}
      {...attributes}
    />
  );
}
