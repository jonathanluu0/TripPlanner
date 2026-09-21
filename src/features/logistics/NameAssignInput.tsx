import { useState, type KeyboardEvent } from 'react';
import { Autocomplete } from '@mantine/core';
import { IconUserPlus } from '@tabler/icons-react';
import { useTripStore } from '../../store/tripStore';
import type { ID, Member } from '../../types';

export interface NameAssignInputProps {
  tripId: ID;
  /** All trip members, used as autocomplete options. */
  members: Member[];
  /** Called with the (possibly newly created) member's id once a name is committed. */
  onAssign: (memberId: ID) => void;
  placeholder?: string;
}

/**
 * Name input that assigns an existing member (picked from the trip roster) or creates a new
 * one (typed name + Enter) and assigns them. Shared by CarCard and SleepingCard drop zones.
 */
export function NameAssignInput({ tripId, members, onAssign, placeholder = 'Add name…' }: NameAssignInputProps) {
  const addMember = useTripStore((s) => s.addMember);
  const [value, setValue] = useState('');

  const commit = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = members.find((m) => m.name.toLowerCase() === trimmed.toLowerCase());
    const memberId = existing ? existing.id : addMember(tripId, trimmed).id;
    onAssign(memberId);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit(value);
    }
  };

  return (
    <Autocomplete
      size="xs"
      value={value}
      onChange={setValue}
      data={members.map((m) => m.name)}
      placeholder={placeholder}
      aria-label={placeholder}
      leftSection={<IconUserPlus size={14} />}
      onOptionSubmit={(val) => commit(val)}
      onKeyDown={handleKeyDown}
      comboboxProps={{ withinPortal: true }}
    />
  );
}
