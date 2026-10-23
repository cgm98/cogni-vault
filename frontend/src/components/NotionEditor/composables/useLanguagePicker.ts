import { ref, computed } from 'vue';
import { onMounted, onUnmounted } from 'vue';

// Selector de lenguaje con búsqueda para CodeBlock.vue. Extraído porque era
// una de las cuatro responsabilidades mezcladas en ese archivo (ver docs de
// auditoría) — no depende del store ni del bloque, solo de un callback para
// aplicar el lenguaje elegido.
export function useLanguagePicker(onSelect: (value: string) => void) {
  const languages = [
    { value: 'mermaid', label: 'Mermaid' },
    { value: 'abc', label: 'Partitura ABC' },
    { value: 'plaintext', label: 'Plain Text' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'tailwind', label: 'Tailwind CSS' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'vue', label: 'Vue' },
    { value: 'react', label: 'React / JSX' },
    { value: 'react-native', label: 'React Native' },
    { value: 'htmx', label: 'HTMX' },
    { value: 'json', label: 'JSON' },
    { value: 'yaml', label: 'YAML' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'c', label: 'C' },
    { value: 'cpp', label: 'C++' },
    { value: 'csharp', label: 'C#' },
    { value: 'vbnet', label: 'VB.NET' },
    { value: 'rust', label: 'Rust' },
    { value: 'go', label: 'Go' },
    { value: 'zig', label: 'Zig' },
    { value: 'php', label: 'PHP' },
    { value: 'laravel', label: 'Laravel' },
    { value: 'ruby', label: 'Ruby' },
    { value: 'swift', label: 'Swift' },
    { value: 'kotlin', label: 'Kotlin' },
    { value: 'dart', label: 'Dart' },
    { value: 'sql', label: 'SQL (Genérico)' },
    { value: 'postgres', label: 'PostgreSQL' },
    { value: 'mysql', label: 'MySQL' },
    { value: 'mariadb', label: 'MariaDB' },
    { value: 'bash', label: 'Bash / Shell' },
    { value: 'powershell', label: 'PowerShell' },
    { value: 'markdown', label: 'Markdown' },
    { value: 'graphql', label: 'GraphQL' },
    { value: 'dockerfile', label: 'Dockerfile' },
    { value: 'makefile', label: 'Makefile' },
    { value: 'ini', label: 'INI' },
    { value: 'r', label: 'R' },
    { value: 'scala', label: 'Scala' },
    { value: 'lua', label: 'Lua' },
    { value: 'perl', label: 'Perl' },
    { value: 'matlab', label: 'MATLAB' },
    { value: 'wasm', label: 'WebAssembly' },
    { value: 'erlang', label: 'Erlang' },
    { value: 'elixir', label: 'Elixir' },
    { value: 'haskell', label: 'Haskell' },
    { value: 'lisp', label: 'Lisp' },
    { value: 'clojure', label: 'Clojure' }
  ];

  const searchQuery = ref('');
  const showDropdown = ref(false);
  const dropdownRef = ref<HTMLElement | null>(null);
  const searchInputRef = ref<HTMLInputElement | null>(null);

  const getLanguageLabel = (val: string | undefined) => {
    const match = languages.find(l => l.value === val);
    return match ? match.label : 'Plain Text';
  };

  const filteredLanguages = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();
    if (!query) return languages;
    return languages.filter(lang =>
      lang.label.toLowerCase().includes(query) ||
      lang.value.toLowerCase().includes(query)
    );
  });

  const onSearchInput = (e: Event) => {
    searchQuery.value = (e.target as HTMLInputElement).value;
    showDropdown.value = true;
  };

  const selectLanguage = (val: string) => {
    onSelect(val);
    searchQuery.value = '';
    showDropdown.value = false;
  };

  const onSearchKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (filteredLanguages.value.length > 0) {
        selectLanguage(filteredLanguages.value[0].value);
      } else {
        showDropdown.value = false;
        searchQuery.value = '';
      }
      searchInputRef.value?.blur();
    }
  };

  const handleOutsideClick = (e: MouseEvent) => {
    if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
      showDropdown.value = false;
      searchQuery.value = '';
    }
  };

  onMounted(() => document.addEventListener('click', handleOutsideClick));
  onUnmounted(() => document.removeEventListener('click', handleOutsideClick));

  return {
    searchQuery,
    showDropdown,
    dropdownRef,
    searchInputRef,
    filteredLanguages,
    getLanguageLabel,
    onSearchInput,
    selectLanguage,
    onSearchKeydown
  };
}
