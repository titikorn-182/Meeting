export function accountEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
export function accountPassword(data: FormData): string | null {
  const password = data.get('password');
  return typeof password === 'string' &&
    password.length >= 12 &&
    password.length <= 128 &&
    password === data.get('confirmation')
    ? password
    : null;
}
