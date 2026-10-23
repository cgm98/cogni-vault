export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : data?.error?.message;
    throw new Error(message || ('No se pudo completar la solicitud (' + response.status + ')'));
  }
  if (data === null) throw new Error('El servidor devolvió una respuesta vacía o inválida');
  return data as T;
}
