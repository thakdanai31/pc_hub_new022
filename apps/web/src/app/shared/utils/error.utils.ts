export interface ApiErrorBody {
  message?: string;
  code?: string;
  fieldErrors?: Record<string, string>;
}

function getStringProp(obj: object, key: string): string | undefined {
  if (key in obj) {
    const val = Reflect.get(obj, key);
    return typeof val === 'string' ? val : undefined;
  }
  return undefined;
}

function getFieldErrors(obj: object): Record<string, string> | undefined {
  if (!('fieldErrors' in obj)) return undefined;
  const raw = Reflect.get(obj, 'fieldErrors');
  if (typeof raw !== 'object' || raw === null) return undefined;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') {
      result[key] = value;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function extractErrorBody(errorPayload: unknown): ApiErrorBody {
  if (typeof errorPayload !== 'object' || errorPayload === null) {
    return {};
  }

  return {
    message: getStringProp(errorPayload, 'message'),
    code: getStringProp(errorPayload, 'code'),
    fieldErrors: getFieldErrors(errorPayload),
  };
}
