export async function chatComplete(prompt: string, _systemPrompt?: string): Promise<string> {
  // Stub local para NoteDraftService
  return `TITULO: Borrador Autogenerado\n\nResumen conceptual de: ${prompt.slice(0, 100)}...`;
}
