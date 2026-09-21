import { Avatar, Tooltip, type AvatarProps } from '@mantine/core';
import type { Member } from '../types';
import { initials } from '../lib/colors';

export interface MemberAvatarProps extends Omit<AvatarProps, 'color' | 'children'> {
  member: Pick<Member, 'name' | 'color'>;
  /** Show the member's name on hover. */
  withTooltip?: boolean;
}

/** Initials avatar in the member's stable color. */
export function MemberAvatar({ member, withTooltip = false, size = 'sm', ...rest }: MemberAvatarProps) {
  const avatar = (
    <Avatar color={member.color} variant="filled" radius="xl" size={size} alt={member.name} {...rest}>
      {initials(member.name)}
    </Avatar>
  );
  return withTooltip ? (
    <Tooltip label={member.name} withArrow>
      {avatar}
    </Tooltip>
  ) : (
    avatar
  );
}
