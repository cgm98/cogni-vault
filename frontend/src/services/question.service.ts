export const QuestionService = {
  async getQuestionsForConcept(_conceptId: string) {
    return [];
  },
  async getForConcept(_conceptId: string) {
    return this.getQuestionsForConcept(_conceptId);
  },
  async getDueQuestions() {
    return [];
  }
};
