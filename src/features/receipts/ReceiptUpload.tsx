import { useRef, useState } from 'react';
import { Button, Group, Modal, Progress, Stack, Text } from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { IconCamera, IconPhoto, IconUpload, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTripStore } from '../../store/tripStore';
import { fromParsedReceipt } from '../../lib/receipts';
import { fileToDataUrl } from './imageUtils';
import { getParser } from './parsers';

export interface ReceiptUploadProps {
  tripId: string;
  opened: boolean;
  onClose: () => void;
  /** Called once the new receipt exists (before or after parsing finishes) so the caller can open the review modal. */
  onUploaded: (receiptId: string) => void;
}

/** "Add receipt" flow: drop / pick / take a photo, parse it, hand off to review — Feature 2. */
export function ReceiptUpload({ tripId, opened, onClose, onUploaded }: ReceiptUploadProps) {
  const addReceipt = useTripStore((s) => s.addReceipt);
  const updateReceipt = useTripStore((s) => s.updateReceipt);
  const [progress, setProgress] = useState<number | null>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setProgress(0);
    const dataUrl = await fileToDataUrl(file);
    const receipt = addReceipt(tripId, { status: 'parsing', imageDataUrl: dataUrl });

    const parser = getParser();
    try {
      const parsed = await parser.parse(file, (p) => setProgress(Math.round(p * 100)));
      updateReceipt(tripId, receipt.id, {
        ...fromParsedReceipt(parsed),
        parser: parser.name,
        status: 'needs_review',
      });
    } catch (err) {
      console.error('Receipt parsing failed:', err);
      notifications.show({
        color: 'red',
        title: 'Could not read the receipt',
        message: "We couldn't parse it automatically — fill in the details manually.",
      });
      updateReceipt(tripId, receipt.id, { status: 'needs_review', parser: 'manual' });
    } finally {
      setProgress(null);
      onUploaded(receipt.id);
      onClose();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add a receipt"
      size="md"
      centered
      closeOnClickOutside={progress === null}
      closeOnEscape={progress === null}
    >
      <Stack gap="sm">
        <Dropzone
          onDrop={(files) => {
            const file = files[0];
            if (file) void handleFile(file);
          }}
          onReject={() =>
            notifications.show({
              color: 'red',
              title: 'Unsupported file',
              message: 'Please choose an image (JPG, PNG, HEIC).',
            })
          }
          accept={IMAGE_MIME_TYPE}
          multiple={false}
          maxSize={20 * 1024 ** 2}
          disabled={progress !== null}
          loading={progress !== null}
        >
          <Group justify="center" gap="md" mih={140} style={{ pointerEvents: 'none' }}>
            <Dropzone.Accept>
              <IconUpload size={36} />
            </Dropzone.Accept>
            <Dropzone.Reject>
              <IconX size={36} />
            </Dropzone.Reject>
            <Dropzone.Idle>
              <IconPhoto size={36} />
            </Dropzone.Idle>
            <Stack gap={2} align="center">
              <Text size="sm" fw={500}>
                Drag a receipt photo here, or click to browse
              </Text>
              <Text size="xs" c="dimmed">
                JPG, PNG, HEIC up to 20MB
              </Text>
            </Stack>
          </Group>
        </Dropzone>

        <Button
          variant="light"
          leftSection={<IconCamera size={18} />}
          disabled={progress !== null}
          onClick={() => captureInputRef.current?.click()}
        >
          Take photo
        </Button>
        <input
          ref={captureInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          disabled={progress !== null}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (file) void handleFile(file);
          }}
        />

        {progress !== null && (
          <Stack gap={4}>
            <Progress value={progress} animated striped />
            <Text size="xs" c="dimmed" ta="center">
              Reading receipt… {progress}%
            </Text>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
