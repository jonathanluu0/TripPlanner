import { useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Divider,
  Grid,
  Group,
  Image,
  Modal,
  Progress,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCamera,
  IconCheck,
  IconPencil,
  IconPhotoOff,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import type { Trip } from '../../types';
import { useTripStore } from '../../store/tripStore';
import { formatCents, receiptComputedTotal, receiptHasMismatch } from '../../lib/money';
import { fromParsedReceipt } from '../../lib/receipts';
import { ItemsTable } from './ItemsTable';
import { SplitControls } from './SplitControls';
import { MoneyInput } from './MoneyInput';
import { fileToDataUrl } from './imageUtils';
import { getParser } from './parsers';

export interface ReviewModalProps {
  trip: Trip;
  receiptId: string;
  opened: boolean;
  onClose: () => void;
}

/** Review & correction modal — Feature 3 (docs/DESIGN.md §4). */
export function ReviewModal({ trip, receiptId, opened, onClose }: ReviewModalProps) {
  const receipt = trip.receipts.find((r) => r.id === receiptId);
  const updateReceipt = useTripStore((s) => s.updateReceipt);
  const addFee = useTripStore((s) => s.addFee);
  const updateFee = useTripStore((s) => s.updateFee);
  const removeFee = useTripStore((s) => s.removeFee);

  const [editing, setEditing] = useState(
    () => receipt?.status === 'confirmed' ? false : !receipt?.imageDataUrl,
  );
  const [zoomed, setZoomed] = useState(false);
  const [reparsing, setReparsing] = useState<number | null>(null);
  const retakeInputRef = useRef<HTMLInputElement>(null);

  if (!receipt) return null;

  const computed = receiptComputedTotal(receipt);
  const mismatch = receiptHasMismatch(receipt);
  const wasConfirmed = receipt.status === 'confirmed';

  const confirm = () => {
    updateReceipt(trip.id, receipt.id, { status: 'confirmed' });
    onClose();
  };

  const handleRetake = async (file: File) => {
    setReparsing(0);
    try {
      const dataUrl = await fileToDataUrl(file);
      updateReceipt(trip.id, receipt.id, { imageDataUrl: dataUrl, status: 'parsing' });
      const parser = getParser();
      const parsed = await parser.parse(file, (p) => setReparsing(Math.round(p * 100)));
      updateReceipt(trip.id, receipt.id, {
        ...fromParsedReceipt(parsed),
        parser: parser.name,
        status: 'needs_review',
      });
      setEditing(false);
    } catch (err) {
      console.error('Re-parsing failed:', err);
      notifications.show({
        color: 'red',
        title: 'Could not read that photo',
        message: 'The receipt image was replaced, but we couldn’t parse it — you can fill it in manually.',
      });
      updateReceipt(trip.id, receipt.id, { status: 'needs_review' });
      setEditing(true);
    } finally {
      setReparsing(null);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={receipt.merchant || 'Receipt'} size="xl" centered>
      <Stack gap="md">
        {!wasConfirmed && !editing && (
          <Alert color="blue" title="Does this look right?">
            <Stack gap="sm">
              <Text size="sm">
                Check the parsed items, tax, tip and total against the photo before it counts toward balances.
              </Text>
              <Group gap="xs">
                <Button size="xs" leftSection={<IconCheck size={14} />} onClick={confirm}>
                  Looks good
                </Button>
                <Button size="xs" variant="light" leftSection={<IconPencil size={14} />} onClick={() => setEditing(true)}>
                  Edit numbers
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  color="gray"
                  leftSection={<IconCamera size={14} />}
                  onClick={() => retakeInputRef.current?.click()}
                >
                  Retake / re-upload
                </Button>
              </Group>
            </Stack>
          </Alert>
        )}

        <input
          ref={retakeInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (file) void handleRetake(file);
          }}
        />

        {reparsing !== null && (
          <Stack gap={4}>
            <Progress value={reparsing} animated striped />
            <Text size="xs" c="dimmed" ta="center">
              Reading new photo… {reparsing}%
            </Text>
          </Stack>
        )}

        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Stack gap="xs">
              {receipt.imageDataUrl ? (
                <div style={{ maxHeight: zoomed ? 640 : 420, overflow: zoomed ? 'auto' : 'hidden' }}>
                  <Image
                    src={receipt.imageDataUrl}
                    radius="md"
                    fit={zoomed ? 'contain' : 'contain'}
                    w={zoomed ? 'auto' : '100%'}
                    mah={zoomed ? undefined : 420}
                    style={{
                      cursor: zoomed ? 'zoom-out' : 'zoom-in',
                      maxWidth: zoomed ? '200%' : '100%',
                    }}
                    onClick={() => setZoomed((z) => !z)}
                  />
                </div>
              ) : (
                <Stack align="center" justify="center" gap={4} mih={200} style={{ border: '1px dashed var(--mantine-color-gray-4)', borderRadius: 8 }}>
                  <IconPhotoOff size={28} color="var(--mantine-color-gray-5)" />
                  <Text size="sm" c="dimmed">
                    No photo
                  </Text>
                </Stack>
              )}
              {receipt.imageDataUrl && (
                <Text size="xs" c="dimmed" ta="center">
                  Click photo to {zoomed ? 'shrink' : 'zoom'}
                </Text>
              )}
              {!wasConfirmed && editing && (
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  leftSection={<IconCamera size={14} />}
                  onClick={() => retakeInputRef.current?.click()}
                >
                  Retake / re-upload
                </Button>
              )}
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 7 }}>
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Badge color={receipt.status === 'confirmed' ? 'teal' : 'orange'} variant="light">
                  {receipt.status === 'confirmed' ? 'Confirmed' : 'Needs review'}
                </Badge>
                {wasConfirmed && !editing && (
                  <Tooltip label="Edit">
                    <ActionIcon variant="subtle" onClick={() => setEditing(true)} aria-label="Edit receipt">
                      <IconPencil size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>

              <Group grow>
                <TextInput
                  label="Merchant"
                  value={receipt.merchant}
                  onChange={(e) => updateReceipt(trip.id, receipt.id, { merchant: e.currentTarget.value })}
                />
                <TextInput
                  label="Date"
                  placeholder="YYYY-MM-DD"
                  value={receipt.date ?? ''}
                  onChange={(e) => updateReceipt(trip.id, receipt.id, { date: e.currentTarget.value || undefined })}
                />
              </Group>

              <ItemsTable tripId={trip.id} receipt={receipt} editable={editing} />

              <Group grow align="flex-start">
                <MoneyInput
                  label="Tax"
                  valueCents={receipt.tax}
                  onChangeCents={(cents) => updateReceipt(trip.id, receipt.id, { tax: cents })}
                  disabled={!editing}
                />
                <MoneyInput
                  label="Tip"
                  valueCents={receipt.tip}
                  onChangeCents={(cents) => updateReceipt(trip.id, receipt.id, { tip: cents })}
                  disabled={!editing}
                />
              </Group>

              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  Fees
                </Text>
                {receipt.fees.length === 0 && (
                  <Text size="xs" c="dimmed">
                    No fees.
                  </Text>
                )}
                {receipt.fees.map((fee) => (
                  <Group key={fee.id} gap="xs" wrap="nowrap">
                    {editing ? (
                      <>
                        <TextInput
                          aria-label="Fee label"
                          size="xs"
                          placeholder="e.g. Resort fee"
                          value={fee.label}
                          onChange={(e) => updateFee(trip.id, receipt.id, fee.id, { label: e.currentTarget.value })}
                          style={{ flex: 1 }}
                        />
                        <MoneyInput
                          aria-label="Fee amount"
                          size="xs"
                          w={110}
                          valueCents={fee.amount}
                          onChangeCents={(cents) => updateFee(trip.id, receipt.id, fee.id, { amount: cents })}
                        />
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label={`Remove ${fee.label || 'fee'}`}
                          onClick={() => removeFee(trip.id, receipt.id, fee.id)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </>
                    ) : (
                      <Text size="sm">
                        {fee.label || 'Fee'} — {formatCents(fee.amount)}
                      </Text>
                    )}
                  </Group>
                ))}
                {editing && (
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    leftSection={<IconPlus size={12} />}
                    onClick={() => addFee(trip.id, receipt.id)}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    Add fee
                  </Button>
                )}
              </Stack>

              <Divider />

              <Group justify="space-between" align="flex-end">
                <Stack gap={2}>
                  <Text size="sm" c="dimmed">
                    Computed total
                  </Text>
                  <Text size="lg" fw={600}>
                    {formatCents(computed)}
                  </Text>
                </Stack>
                <MoneyInput
                  label="Printed total"
                  valueCents={receipt.total}
                  onChangeCents={(cents) => updateReceipt(trip.id, receipt.id, { total: cents })}
                  disabled={!editing}
                  w={140}
                />
              </Group>

              {mismatch && (
                <Alert color="yellow" icon={<IconAlertTriangle size={16} />} title="Totals don't match">
                  <Stack gap={6}>
                    <Text size="sm">
                      Items + tax + tip + fees add up to {formatCents(computed)}, but the printed total is{' '}
                      {formatCents(receipt.total)}.
                    </Text>
                    <Button
                      size="xs"
                      variant="light"
                      color="yellow"
                      style={{ alignSelf: 'flex-start' }}
                      onClick={() => updateReceipt(trip.id, receipt.id, { total: computed })}
                    >
                      Use computed total
                    </Button>
                  </Stack>
                </Alert>
              )}

              <Divider />

              <SplitControls trip={trip} receipt={receipt} />

              {editing && (
                <Group justify="flex-end">
                  {wasConfirmed ? (
                    <Button leftSection={<IconCheck size={16} />} onClick={() => setEditing(false)}>
                      Done
                    </Button>
                  ) : (
                    <Button leftSection={<IconCheck size={16} />} onClick={confirm}>
                      Save &amp; confirm
                    </Button>
                  )}
                </Group>
              )}
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Modal>
  );
}
