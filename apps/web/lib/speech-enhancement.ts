'use client';

import type {
  GtcrnWorkletNode,
  NoiseGateWorkletNode,
} from '@sapphi-red/web-noise-suppressor';

const GTCRN_WASM_PATH = '/audio/gtcrn.wasm';
const GTCRN_WORKLET_PATH = '/audio/gtcrn-worklet.js';
const NOISE_GATE_WORKLET_PATH = '/audio/noise-gate-worklet.js';
const PIPELINE_START_TIMEOUT_MS = 8_000;

let gtcrnBinaryPromise: Promise<ArrayBuffer> | null = null;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error('Speech enhancement pipeline timed out')),
      timeoutMs,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

export type EnhancedMediaStream = {
  stream: MediaStream;
  rawStream: MediaStream;
  enhanced: boolean;
  close: () => void;
};

function loadGtcrnBinary(): Promise<ArrayBuffer> {
  gtcrnBinaryPromise ??= import('@sapphi-red/web-noise-suppressor')
    .then(({ loadGtcrn }) => loadGtcrn({ url: GTCRN_WASM_PATH }))
    .catch((error) => {
      gtcrnBinaryPromise = null;
      throw error;
    });
  return gtcrnBinaryPromise;
}

/**
 * Keeps browser AEC/AGC in the capture stage and applies GTCRN to the outgoing
 * microphone track. The raw capture is retained so constraints can be updated
 * without applying them to the synthetic AudioWorklet output track.
 */
export async function enhanceSpeechStream(
  rawStream: MediaStream,
  enabled: boolean,
): Promise<EnhancedMediaStream> {
  const rawAudioTrack = rawStream.getAudioTracks()[0];
  if (!enabled || !rawAudioTrack || typeof AudioWorkletNode === 'undefined') {
    return {
      stream: rawStream,
      rawStream,
      enhanced: false,
      close: () => rawStream.getTracks().forEach((track) => track.stop()),
    };
  }

  let context: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: GtcrnWorkletNode | null = null;
  let gate: NoiseGateWorkletNode | null = null;
  let destination: MediaStreamAudioDestinationNode | null = null;
  try {
    context = new AudioContext({ latencyHint: 'interactive', sampleRate: 48_000 });
    const [noiseSuppressor, wasmBinary] = await withTimeout(
      Promise.all([
        import('@sapphi-red/web-noise-suppressor'),
        loadGtcrnBinary(),
        context.audioWorklet.addModule(GTCRN_WORKLET_PATH),
        context.audioWorklet.addModule(NOISE_GATE_WORKLET_PATH),
      ]),
      PIPELINE_START_TIMEOUT_MS,
    );
    const { GtcrnWorkletNode, NoiseGateWorkletNode } = noiseSuppressor;
    source = context.createMediaStreamSource(new MediaStream([rawAudioTrack]));
    processor = new GtcrnWorkletNode(context, { maxChannels: 1, wasmBinary });
    gate = new NoiseGateWorkletNode(context, {
      maxChannels: 1,
      openThreshold: -40,
      closeThreshold: -48,
      holdMs: 220,
    });
    destination = context.createMediaStreamDestination();
    source.connect(processor);
    processor.connect(gate);
    gate.connect(destination);
    if (context.state === 'suspended') await context.resume();

    const enhancedTrack = destination.stream.getAudioTracks()[0];
    if (!enhancedTrack) throw new Error('GTCRN did not produce an audio track');
    if ('contentHint' in enhancedTrack) enhancedTrack.contentHint = 'speech';
    const stream = new MediaStream([
      enhancedTrack,
      ...rawStream.getVideoTracks(),
    ]);
    let closed = false;
    return {
      stream,
      rawStream,
      enhanced: true,
      close: () => {
        if (closed) return;
        closed = true;
        source?.disconnect();
        processor?.disconnect();
        processor?.destroy();
        gate?.disconnect();
        destination?.disconnect();
        enhancedTrack.stop();
        rawStream.getTracks().forEach((track) => track.stop());
        void context?.close();
      },
    };
  } catch {
    source?.disconnect();
    processor?.disconnect();
    processor?.destroy();
    gate?.disconnect();
    destination?.disconnect();
    void context?.close();
    return {
      stream: rawStream,
      rawStream,
      enhanced: false,
      close: () => rawStream.getTracks().forEach((track) => track.stop()),
    };
  }
}
