/** ₦6,000 / ₦6,000.50 — display only; money maths always uses Decimal on the server. */
export function formatNaira(value: string): string {
  const [whole, cents] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return cents && cents !== '00' ? `₦${grouped}.${cents}` : `₦${grouped}`;
}
