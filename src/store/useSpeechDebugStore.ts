import {create} from 'zustand';
import type {NegotiationStrategyReply} from '../ai/negotiationStrategy';
import type {SpeechNegotiationRequest, SpeechNegotiationResponse} from '../services/speechNegotiation';
import {addTelemetryListener, type TelemetryPayload} from '../services/telemetry';

export interface TelemetryEventRecord {
  id: string;
  name: string;
  timestamp: number;
  payload: TelemetryPayload;
}

export interface SpeechDebugState {
  isRecording: boolean;
  lastPartialTranscript: string | null;
  lastFinalTranscript: string | null;
  lastRequest: SpeechNegotiationRequest | null;
  lastResponse: SpeechNegotiationResponse | null;
  lastStrategy: NegotiationStrategyReply | null;
  lastError: string | null;
  telemetryEvents: TelemetryEventRecord[];
  setRecording: (isRecording: boolean) => void;
  setPartialTranscript: (text: string) => void;
  setFinalTranscript: (text: string) => void;
  setRequest: (request: SpeechNegotiationRequest) => void;
  setResponse: (response: SpeechNegotiationResponse) => void;
  setError: (message: string | null) => void;
  appendTelemetryEvent: (name: string, payload: TelemetryPayload) => void;
  clearTelemetry: () => void;
}

const MAX_TELEMETRY_EVENTS = 25;

export const useSpeechDebugStore = create<SpeechDebugState>(set => ({
  isRecording: false,
  lastPartialTranscript: null,
  lastFinalTranscript: null,
  lastRequest: null,
  lastResponse: null,
  lastStrategy: null,
  lastError: null,
  telemetryEvents: [],
  setRecording: isRecording => set({isRecording}),
  setPartialTranscript: text => set({lastPartialTranscript: text}),
  setFinalTranscript: text => set({lastFinalTranscript: text}),
  setRequest: request => set({lastRequest: request, lastError: null}),
  setResponse: response =>
    set({
      lastResponse: response,
      lastStrategy: response.strategy,
      lastError: null,
    }),
  setError: message =>
    set({
      lastError: message,
      lastResponse: null,
      lastStrategy: null,
    }),
  appendTelemetryEvent: (name, payload) => {
    const record: TelemetryEventRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      timestamp: Date.now(),
      payload,
    };
    set(state => ({
      telemetryEvents: [record, ...state.telemetryEvents].slice(0, MAX_TELEMETRY_EVENTS),
    }));
  },
  clearTelemetry: () => set({telemetryEvents: []}),
}));

addTelemetryListener((event, payload) => {
  useSpeechDebugStore.getState().appendTelemetryEvent(event, payload);
});
