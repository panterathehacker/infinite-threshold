export enum GameState {
  LOBBY = 'LOBBY',
  HALLWAY = 'HALLWAY',
  GENERATING = 'GENERATING',
  EXPLORING = 'EXPLORING',
  ERROR = 'ERROR'
}

export interface WorldData {
  id: string;
  theme: string;
  splatUrl: string;
  imageUrl?: string;
}
