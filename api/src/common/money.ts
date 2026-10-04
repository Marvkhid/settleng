import Decimal from 'decimal.js';

type DecimalLike = Decimal.Value | { toFixed(): string };

/** Safe conversion from Prisma Decimal / string / number to decimal.js. */
export const D = (v: DecimalLike | null | undefined): Decimal => {
  if (v === null || v === undefined) return new Decimal(0);
  if (
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'bigint' ||
    v instanceof Decimal
  )
    return new Decimal(v);
  return new Decimal(v.toFixed());
};

/** Money crosses the API as a string with exactly two decimals, never a float. */
export const money = (v: DecimalLike): string => D(v).toFixed(2);

export const MONEY_REGEX = /^\d{1,12}(\.\d{1,2})?$/;
export const MONEY_MESSAGE =
  'Enter a valid amount, for example 2500 or 2500.50';
export const QTY_REGEX = /^\d{1,8}(\.\d{1,2})?$/;
export const QTY_MESSAGE = 'Enter a valid quantity, for example 2 or 1.5';
