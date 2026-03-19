import type { Response } from 'supertest';

export function extractCookie(res: Response, name: string): string | null {
  const cookies = res.headers['set-cookie'];
  if (!cookies) return null;

  const cookieArray = Array.isArray(cookies) ? cookies : [String(cookies)];
  for (const cookie of cookieArray) {
    if (cookie.startsWith(`${name}=`)) {
      const nameValue = cookie.split(';')[0];
      return nameValue ?? null;
    }
  }
  return null;
}

function getNestedProp(obj: unknown, ...keys: string[]): unknown {
  let current: unknown = obj;
  for (const key of keys) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = Reflect.get(current, key);
  }
  return current;
}

export function getBodyString(res: Response, ...path: string[]): string {
  const val = getNestedProp(res.body, ...path);
  if (typeof val !== 'string') {
    throw new Error(`Expected string at body.${path.join('.')}, got ${typeof val}`);
  }
  return val;
}

export function getBodyNumber(res: Response, ...path: string[]): number {
  const val = getNestedProp(res.body, ...path);
  if (typeof val !== 'number') {
    throw new Error(`Expected number at body.${path.join('.')}, got ${typeof val}`);
  }
  return val;
}

export function getBodyArray(res: Response, ...path: string[]): unknown[] {
  const val = getNestedProp(res.body, ...path);
  if (!Array.isArray(val)) {
    throw new Error(`Expected array at body.${path.join('.')}, got ${typeof val}`);
  }
  return val;
}

export function getNumberProp(obj: unknown, key: string): number | undefined {
  if (typeof obj !== 'object' || obj === null) return undefined;
  const val = Reflect.get(obj, key);
  return typeof val === 'number' ? val : undefined;
}

export function getBoolProp(obj: unknown, key: string): boolean | undefined {
  if (typeof obj !== 'object' || obj === null) return undefined;
  const val = Reflect.get(obj, key);
  return typeof val === 'boolean' ? val : undefined;
}
