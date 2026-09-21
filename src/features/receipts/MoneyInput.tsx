import { NumberInput, type NumberInputProps } from '@mantine/core';
import type { Cents } from '../../types';

export interface MoneyInputProps
  extends Omit<NumberInputProps, 'value' | 'onChange' | 'prefix' | 'decimalScale' | 'fixedDecimalScale'> {
  valueCents: Cents;
  onChangeCents: (cents: Cents) => void;
}

/** NumberInput bound to integer cents: "$" prefix, 2 decimals, converts on the way in/out. */
export function MoneyInput({ valueCents, onChangeCents, ...rest }: MoneyInputProps) {
  return (
    <NumberInput
      prefix="$"
      decimalScale={2}
      fixedDecimalScale
      thousandSeparator=","
      hideControls
      value={Math.round(valueCents) / 100}
      onChange={(v) => {
        const n = typeof v === 'number' ? v : Number.parseFloat(v);
        onChangeCents(Number.isFinite(n) ? Math.round(n * 100) : 0);
      }}
      {...rest}
    />
  );
}
