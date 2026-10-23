import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(true);
  const mode = ref('dark');
  const preset = ref('default');
  const primary = ref('#7b5cea');
  const secondary = ref('#4c32a8');

  function toggleTheme() {
    isDark.value = !isDark.value;
    mode.value = isDark.value ? 'dark' : 'light';
  }
  return { isDark, mode, preset, primary, secondary, toggleTheme };
});
