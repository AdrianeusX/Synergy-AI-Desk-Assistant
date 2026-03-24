export enum AppState {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  IN_CALL = 'IN_CALL',
  ENDING = 'ENDING',
  ENDED = 'ENDED'
}

export enum SpeakerState {
  SILENT = 'SILENT',
  USER_SPEAKING = 'USER_SPEAKING',
  SYNERGY_SPEAKING = 'SYNERGY_SPEAKING'
}

export interface AudioVisualizerData {
  volume: number; // 0.0 to 1.0
  isSpeaking: boolean;
}