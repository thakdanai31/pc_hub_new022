export function normalizePhoneNumber(value: string): string {
  return value.trim().replaceAll(' ', '').replaceAll('-', '');
}
