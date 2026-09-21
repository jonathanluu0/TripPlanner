import { useState } from 'react';
import { Button, Group, Stack, Text, Title } from '@mantine/core';
import { IconPencilPlus, IconReceipt, IconUpload } from '@tabler/icons-react';
import { useTrip, useTripStore } from '../../store/tripStore';
import { ReceiptUpload } from './ReceiptUpload';
import { ReceiptCard } from './ReceiptCard';
import { ReviewModal } from './ReviewModal';
import { BalancesCard } from './BalancesCard';

/**
 * Expenses tab — Features 2 & 3 (docs/DESIGN.md §4): upload/parse/review receipts,
 * split them evenly, and settle up. Keep the exported signature stable.
 */
export function ReceiptsPanel({ tripId }: { tripId: string }) {
  const trip = useTrip(tripId);
  const addReceipt = useTripStore((s) => s.addReceipt);
  const [uploadOpened, setUploadOpened] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);

  if (!trip) return null;

  const enterManually = () => {
    const receipt = addReceipt(tripId, { status: 'needs_review', parser: 'manual', confidence: 1 });
    setReviewId(receipt.id);
  };

  const receipts = [...trip.receipts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const reviewReceipt = reviewId ? trip.receipts.find((r) => r.id === reviewId) : undefined;

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
        <Group gap="xs">
          <IconReceipt size={20} />
          <Title order={4}>Expenses</Title>
        </Group>
        <Group gap="xs">
          <Button variant="light" leftSection={<IconPencilPlus size={16} />} onClick={enterManually}>
            Enter manually
          </Button>
          <Button leftSection={<IconUpload size={16} />} onClick={() => setUploadOpened(true)}>
            Add receipt
          </Button>
        </Group>
      </Group>

      {receipts.length === 0 ? (
        <Text c="dimmed" size="sm" ta="center" py="xl">
          No receipts yet. Add one to start splitting costs.
        </Text>
      ) : (
        <Stack gap="sm">
          {receipts.map((r) => (
            <ReceiptCard key={r.id} trip={trip} receipt={r} onOpen={() => setReviewId(r.id)} />
          ))}
        </Stack>
      )}

      <BalancesCard trip={trip} />

      <ReceiptUpload
        tripId={tripId}
        opened={uploadOpened}
        onClose={() => setUploadOpened(false)}
        onUploaded={(receiptId) => setReviewId(receiptId)}
      />

      {reviewReceipt && (
        <ReviewModal trip={trip} receiptId={reviewReceipt.id} opened onClose={() => setReviewId(null)} />
      )}
    </Stack>
  );
}
