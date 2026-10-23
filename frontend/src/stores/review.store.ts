import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useReviewStore = defineStore('review', () => {
  const queue = ref<any[]>([]);
  const dueCounts = ref<any>({ total: 0 });

  async function fetchDueCounts() {
    // Stub
  }

  async function fetchDueQuestions() {
    return [];
  }

  async function submitReview(_reviewData?: any) {
    // Stub
  }

  return { queue, dueCounts, fetchDueCounts, fetchDueQuestions, submitReview };
});
