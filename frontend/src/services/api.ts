import { errorKey } from "../i18n/errors";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: unknown,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        "X-Requested-With": "ReservaCR",
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      0,
      "errors:NETWORK_ERROR",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status,
      errorKey(data?.code, Array.isArray(data?.message)
        ? data.message.join(". ")
        : typeof data?.message === "string" && data.message ? data.message : "errors:REQUEST_FAILED", data?.fieldErrors),
      data?.fieldErrors,
    );
  return data;
}
export const send = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
