# Cogni-Vault

Aplicación de notas y gestión de conocimiento con Vue 3, TypeScript, Express y SQLite.

## Funcionalidades

- **Notas** (`/notes`): editor por bloques, Markdown, fórmulas KaTeX, enlaces entre notas, historial e importación/exportación.
- **Conocimiento** (`/knowledge`): resumen de notas, distribución por dominio y repasos.
- **Taxonomía** (`/taxonomy`): organización por cerebros, áreas, dominios y temas.
- **Flashcards** (`/challenge`): interfaz de repaso.

Las secciones de grafo, estudio de diagramas y contactos/relaciones fueron retiradas junto con sus rutas, APIs y código exclusivo. Las URLs no reconocidas redirigen a Notas.

El editor mantiene los bloques Mermaid incluidos en las notas. Las relaciones internas entre conceptos se conservan para la compatibilidad de respaldos, sugerencias y preguntas; no tienen una API pública de gestión. No se borran tablas ni datos existentes al retirar las secciones.

## Desarrollo

Desde la raíz:

```bash
npm install
npm run dev
```

Frontend: puerto 5173. Backend: puerto 3000. Vite redirige las peticiones `/api` al backend. Ejecuta una sola instancia para evitar conflictos de puertos.

## Verificación

```bash
npm run typecheck
npm run build
```

La base de datos se encuentra en `db/cogni_vault.db`. Puede seleccionarse otra mediante `COGNI_VAULT_DB_PATH`.
