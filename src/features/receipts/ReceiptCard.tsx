import { ActionIcon, Badge, Card, Group, Image, Menu, Stack, Text } from '@mantine/core';
import { IconDots, IconPhoto, IconTrash } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import type { Receipt, Trip } from '../../types';
import { useTripStore } from '../../store/tripStore';
import { formatCents } from '../../lib/money';
import { MemberAvatar } from '../../components/MemberAvatar';
import { SplitControls } from './SplitControls';

export interface ReceiptCardProps {
  trip: Trip;
  receipt: Receipt;
  onOpen: () => void;
}

const STATUS_LABEL: Record<Receipt['status'], string> = {
  parsing: 'Scanning…',
  needs_review: 'Needs review',
  confirmed: 'Confirmed',
};
const STATUS_COLOR: Record<Receipt['status'], string> = {
  parsing: 'gray',
  needs_review: 'orange',
  confirmed: 'teal',
};

/** One receipt in the expenses list: thumbnail, status, split controls — Feature 2. */
export function ReceiptCard({ trip, receipt, onOpen }: ReceiptCardProps) {
  const removeReceipt = useTripStore((s) => s.removeReceipt);
  const payer = trip.members.find((m) => m.id === receipt.paidById);

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: 'Delete this receipt?',
      children: <Text size="sm">This removes it from the expenses list and balances. It can't be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => removeReceipt(trip.id, receipt.id),
    });

  return (
    <Card padding="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1, cursor: 'pointer' }} onClick={onOpen}>
            {receipt.imageDataUrl ? (
              <Image src={receipt.imageDataUrl} w={56} h={56} radius="sm" fit="cover" />
            ) : (
              <Group w={56} h={56} justify="center" align="center" style={{ border: '1px dashed var(--mantine-color-gray-4)', borderRadius: 6 }}>
                <IconPhoto size={22} color="var(--mantine-color-gray-5)" />
              </Group>
            )}
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Text fw={600} truncate>
                {receipt.merchant || 'Untitled receipt'}
              </Text>
              <Group gap={6}>
                {receipt.date && (
                  <Text size="xs" c="dimmed">
                    {receipt.date}
                  </Text>
                )}
                <Badge size="xs" variant="light" color={STATUS_COLOR[receipt.status]}>
                  {STATUS_LABEL[receipt.status]}
                </Badge>
              </Group>
            </Stack>
          </Group>

          <Group gap="xs" wrap="nowrap">
            <Stack gap={0} align="flex-end">
              <Text fw={700} c="orange">
                {formatCents(receipt.total)}
              </Text>
              {payer && (
                <Group gap={4}>
                  <Text size="xs" c="dimmed">
                    paid by
                  </Text>
                  <MemberAvatar member={payer} size={18} withTooltip />
                </Group>
              )}
            </Stack>
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" aria-label="Receipt options">
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={confirmDelete}>
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        <SplitControls trip={trip} receipt={receipt} compact />
      </Stack>
    </Card>
  );
}
