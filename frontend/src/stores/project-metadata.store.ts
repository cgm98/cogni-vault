import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useProjectMetadataStore = defineStore('projectMetadata', () => {
  const metadata = ref<Record<string, any>>({});
  const projects = ref<any[]>([]);

  async function fetchAll() {
    projects.value = [];
  }

  return { metadata, projects, fetchAll };
});
