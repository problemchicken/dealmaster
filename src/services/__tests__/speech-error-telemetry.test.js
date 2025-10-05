const mockTrackSttEvent = jest.fn();
const mockNormalizeTelemetryErrorCode = jest.fn(code => code);

const mockListeners = {};
const mockAddListener = jest.fn((event, handler) => {
  if (!mockListeners[event]) {
    mockListeners[event] = [];
  }
  mockListeners[event].push(handler);
  return {remove: jest.fn()};
});

jest.mock('react-native', () => ({
  NativeModules: {
    SpeechModule: {
      startTranscribing: jest.fn(),
      stopTranscribing: jest.fn(),
      cancelTranscribing: jest.fn(),
      getPermissionStatus: jest.fn(),
      requestPermission: jest.fn(),
    },
  },
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: mockAddListener,
  })),
  Platform: {OS: 'ios'},
  __listeners: mockListeners,
}));

jest.mock('../telemetry', () => ({
  trackSttEvent: (...args) => mockTrackSttEvent(...args),
  normalizeTelemetryErrorCode: code => mockNormalizeTelemetryErrorCode(code),
}));

describe('speech native error telemetry', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    Object.keys(mockListeners).forEach(key => {
      mockListeners[key] = [];
    });
    mockNormalizeTelemetryErrorCode.mockImplementation(code => code);
  });

  it('reports retry metadata when native error events occur', () => {
    jest.isolateModules(() => {
      require('../speech');
    });

    const reactNative = require('react-native');
    const errorListeners = reactNative.__listeners['stt_error'];
    expect(errorListeners).toBeDefined();
    expect(errorListeners.length).toBeGreaterThan(0);

    const payload = {
      error_code: 'timeout',
      message: 'Network unstable',
      retry_count: 2,
      will_retry: true,
    };

    errorListeners.forEach(listener => listener(payload));

    expect(mockTrackSttEvent).toHaveBeenCalledWith(
      'stt_error',
      expect.objectContaining({
        error_code: 'timeout',
        message: 'Network unstable',
        retry_count: 2,
        will_retry: true,
        native_flag: true,
        provider: 'native',
        platform: 'ios',
      }),
    );
  });
});
