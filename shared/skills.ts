export interface Skill {
  id: string;
  name: string;
  prompt: string;
}

export const DEFAULT_SKILLS: Skill[] = [
  {
    id: 'default-assistant',
    name: 'Assistant',
    prompt: '你是一个有用、专业、诚实且无害的人工智能助手。请以礼貌、清晰和准确的方式回答用户的每一个问题。',
  },
];
