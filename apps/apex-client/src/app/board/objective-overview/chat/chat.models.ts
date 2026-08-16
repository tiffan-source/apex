export type MessageViewModel = {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}
