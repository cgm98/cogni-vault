import { TopicRepository } from '../../../infrastructure/repositories/topic.repository.js';
import { TopicService } from '../../services/topic.service.js';

export const topicRepository = new TopicRepository();
export const topicService = new TopicService(topicRepository);
