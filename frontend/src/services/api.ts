export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
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
      "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status,
      Array.isArray(data?.message)
        ? data.message.join(". ")
        : data?.message || "No se pudo completar la solicitud.",
    );
  return data;
}
export const send = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
