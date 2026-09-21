import { Fragment } from 'react';
import { ActionIcon, Button, Group, NumberInput, Table, Text, TextInput } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import type { Receipt } from '../../types';
import { useTripStore } from '../../store/tripStore';
import { itemLineTotal, formatCents } from '../../lib/money';
import { MoneyInput } from './MoneyInput';

export interface ItemsTableProps {
  tripId: string;
  receipt: Receipt;
  editable: boolean;
}

/** Item name ↔ base price (+ qty) table with per-item "extra cost" sub-rows — Feature 3. */
export function ItemsTable({ tripId, receipt, editable }: ItemsTableProps) {
  const addReceiptItem = useTripStore((s) => s.addReceiptItem);
  const updateReceiptItem = useTripStore((s) => s.updateReceiptItem);
  const removeReceiptItem = useTripStore((s) => s.removeReceiptItem);
  const addItemExtra = useTripStore((s) => s.addItemExtra);
  const updateItemExtra = useTripStore((s) => s.updateItemExtra);
  const removeItemExtra = useTripStore((s) => s.removeItemExtra);

  return (
    <Table verticalSpacing={6} highlightOnHover={false}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Item</Table.Th>
          <Table.Th w={100}>Price</Table.Th>
          <Table.Th w={72}>Qty</Table.Th>
          <Table.Th w={100}>Line total</Table.Th>
          {editable && <Table.Th w={40} />}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {receipt.items.length === 0 && (
          <Table.Tr>
            <Table.Td colSpan={editable ? 5 : 4}>
              <Text size="sm" c="dimmed" ta="center" py="sm">
                No items yet.
              </Text>
            </Table.Td>
          </Table.Tr>
        )}
        {receipt.items.map((item) => (
          <Fragment key={item.id}>
            <Table.Tr>
              <Table.Td>
                {editable ? (
                  <TextInput
                    aria-label="Item name"
                    size="xs"
                    value={item.name}
                    onChange={(e) => updateReceiptItem(tripId, receipt.id, item.id, { name: e.currentTarget.value })}
                  />
                ) : (
                  <Text size="sm">{item.name || 'Item'}</Text>
                )}
              </Table.Td>
              <Table.Td>
                {editable ? (
                  <MoneyInput
                    aria-label="Base price"
                    size="xs"
                    valueCents={item.basePrice}
                    onChangeCents={(cents) => updateReceiptItem(tripId, receipt.id, item.id, { basePrice: cents })}
                  />
                ) : (
                  <Text size="sm">{formatCents(item.basePrice)}</Text>
                )}
              </Table.Td>
              <Table.Td>
                {editable ? (
                  <NumberInput
                    aria-label="Quantity"
                    size="xs"
                    min={1}
                    hideControls
                    value={item.quantity}
                    onChange={(v) =>
                      updateReceiptItem(tripId, receipt.id, item.id, {
                        quantity: Math.max(1, typeof v === 'number' ? v : Number.parseInt(v, 10) || 1),
                      })
                    }
                  />
                ) : (
                  <Text size="sm">{item.quantity > 1 ? `×${item.quantity}` : '—'}</Text>
                )}
              </Table.Td>
              <Table.Td>
                <Text size="sm" fw={500}>
                  {formatCents(itemLineTotal(item))}
                </Text>
              </Table.Td>
              {editable && (
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label={`Remove ${item.name || 'item'}`}
                    onClick={() => removeReceiptItem(tripId, receipt.id, item.id)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              )}
            </Table.Tr>
            {item.extras.map((extra) => (
              <Table.Tr key={extra.id}>
                <Table.Td pl="xl">
                  {editable ? (
                    <TextInput
                      aria-label="Extra cost label"
                      size="xs"
                      placeholder="e.g. Guac"
                      value={extra.label}
                      onChange={(e) =>
                        updateItemExtra(tripId, receipt.id, item.id, extra.id, { label: e.currentTarget.value })
                      }
                    />
                  ) : (
                    <Text size="xs" c="dimmed">
                      + {extra.label || 'Extra'}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {editable ? (
                    <MoneyInput
                      aria-label="Extra cost amount"
                      size="xs"
                      valueCents={extra.amount}
                      onChangeCents={(cents) =>
                        updateItemExtra(tripId, receipt.id, item.id, extra.id, { amount: cents })
                      }
                    />
                  ) : (
                    <Text size="xs" c="dimmed">
                      {formatCents(extra.amount)}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td />
                <Table.Td />
                {editable && (
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Remove ${extra.label || 'extra cost'}`}
                      onClick={() => removeItemExtra(tripId, receipt.id, item.id, extra.id)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
            {editable && (
              <Table.Tr key={`${item.id}-add-extra`}>
                <Table.Td colSpan={5} pl="xl">
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    leftSection={<IconPlus size={12} />}
                    onClick={() => addItemExtra(tripId, receipt.id, item.id)}
                  >
                    Extra cost
                  </Button>
                </Table.Td>
              </Table.Tr>
            )}
          </Fragment>
        ))}
      </Table.Tbody>
      {editable && (
        <Table.Caption>
          <Group justify="flex-start">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={() => addReceiptItem(tripId, receipt.id)}
            >
              Add item
            </Button>
          </Group>
        </Table.Caption>
      )}
    </Table>
  );
}
