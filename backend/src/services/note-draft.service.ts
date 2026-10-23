import { chatComplete } from '../../infrastructure/doc-index/ollama-client.js';

export interface NoteDraftInput {
  source: string;
  // Pista de dónde viene el contenido (ej. un path de archivo): ayuda al modelo a situar
  // el fragmento sin tener que adivinarlo del texto solo.
  hint?: string;
}

export interface NoteDraftResult {
  title: string;
  explanation: string;
}

// Calibrado para el modelo configurado hoy (phi3.5, contexto de 131072 tokens — ver
// OLLAMA_CHAT_MODEL) — el límite viejo (6000, calibrado para gemma:2b) truncaba un ADR real
// de 8785 caracteres justo antes de su sección "Implementation Log", y el draft resultante
// describía trabajo YA HECHO como una propuesta a futuro. 40000 caracteres cubre cómodamente
// cualquier doc/archivo de código individual de este repo sin acercarse al techo real del
// modelo. Si en el futuro se usa un modelo con ventana chica de nuevo, hay que bajar esto.
const MAX_SOURCE_CHARS = 40000;

const SYSTEM_PROMPT = `Sos un asistente que redacta notas de conocimiento técnico, breves y claras, en español, a partir de código o texto que te pasan. Respondé SIEMPRE con este formato exacto, sin nada antes ni después:
TITULO: <título corto, una sola línea>
<cuerpo de la nota en markdown: qué es y por qué importa, 1-3 párrafos o una lista breve>`;

export class NoteDraftService {
  async draft(input: NoteDraftInput): Promise<NoteDraftResult> {
    const source = input.source.slice(0, MAX_SOURCE_CHARS);
    const context = input.hint ? `Archivo: ${input.hint}\n\n` : '';
    const userPrompt = `${context}Redactá una nota que explique el siguiente contenido:\n\n${source}`;

    const raw = await chatComplete(userPrompt, SYSTEM_PROMPT);
    return this.parse(raw);
  }

  // Un modelo de 2B no siempre respeta el formato pedido al pie de la letra: si no
  // aparece "TITULO:", el texto completo pasa a ser la explicación y el título sale de
  // la primera línea no vacía, en vez de devolver un draft vacío.
  private parse(raw: string): NoteDraftResult {
    const text = raw.trim();
    // phi3.5 no es consistente con el formato pedido — verificado en vivo con 2 corridas
    // reales sobre el mismo ADR largo, cada una lo rompió distinto:
    //  1) "### Título: <texto>" — heading markdown antepuesto al marcador.
    //  2) "## Nota: <texto>\n\n**Título:** <texto real>\n\n<cuerpo>" — el marcador real
    //     aparece recién en la SEGUNDA línea, con una línea de preámbulo redundante antes.
    // Por eso el regex ya no ancla al inicio del string (sin `^`): busca "TITULO"/"Título"
    // en cualquier punto (tolerando # de heading y ** de negrita alrededor) y descarta todo
    // lo que haya antes como preámbulo, en vez de fallar entero y caer al fallback que corta
    // a mitad de palabra en el char 80.
    const match = text.match(/#{0,3}\s*\*{0,2}T[IÍ]TULO:?\*{0,2}\s*(.+?)\r?\n+([\s\S]*)$/i);
    if (match) {
      const title = match[1].trim();
      return { title, explanation: match[2].trim() || title };
    }
    // Una 3ra corrida real sobre el mismo ADR ni siquiera incluyó "TITULO"/"Título" en
    // ningún punto del texto — el marcador no es solo inconsistente en formato, a veces
    // directamente no aparece. Acá el fallback antes cortaba la primera línea a los 80
    // caracteres a lo bruto, partiendo palabras a la mitad ("...en Do", "...del motor Kuzu
    // y"). Ahora: pela el heading/negrita markdown de esa línea primero, y si igual excede
    // 80 corta en el último espacio antes del límite, no en medio de una palabra.
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const firstLine = (lines[0] || '').replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '').trim();
    const title = firstLine.length <= 80
      ? firstLine
      : firstLine.slice(0, firstLine.lastIndexOf(' ', 80) > 0 ? firstLine.lastIndexOf(' ', 80) : 80).trim() + '…';
    return { title: title || 'Nota generada', explanation: text || 'Nota generada' };
  }
}
