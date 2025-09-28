import { describe, test, expect, beforeAll, afterAll } from 'vitest';
//import { EasyMidiBackend } from '@/core/backends/EasyMidiBackend.js'
//import { EasyMidiBackend } from '@/core/backends/EasyMidiBackend';
import { Input, Output } from 'easymidi';

describe('MIDI Loopback Test', () => {
  let myInput: Input;
  let myOutput: Output;
  const MIDI_PORT_NAME = 'TestPort_' + Date.now();

  beforeAll(async () => {
    // Create virtual MIDI ports
    myInput = new Input(MIDI_PORT_NAME, true); // true = virtual port
    myOutput = new Output(MIDI_PORT_NAME, true);

    // Small delay to ensure ports are ready
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterAll(() => {
    // Clean up MIDI ports
    if (myInput) {
      myInput.close();
    }
    if (myOutput) {
      myOutput.close();
    }
  });

  test('should send and receive a note on message', async () => {
    const testMessage = {
      channel: 0,
      note: 60, // Middle C
      velocity: 127,
    };

    // Promise to capture the received message
    const messageReceived = new Promise<Message>((resolve) => {
      myInput.on('noteon', (msg) => {
        resolve(msg);
      });
    });

    // Send the MIDI message
    myOutput.send('noteon', testMessage);

    // Wait for and verify the received message
    const receivedMessage = await messageReceived;

    expect(receivedMessage.channel).toBe(testMessage.channel);
    expect(receivedMessage.note).toBe(testMessage.note);
    expect(receivedMessage.velocity).toBe(testMessage.velocity);
  });

  test('should send and receive a control change message', async () => {
    const testMessage = {
      channel: 1,
      controller: 7, // Volume controller
      value: 100,
    };

    const messageReceived = new Promise<Message>((resolve) => {
      myInput.on('cc', (msg) => {
        resolve(msg);
      });
    });

    myOutput.send('cc', testMessage);

    const receivedMessage = await messageReceived;

    expect(receivedMessage.channel).toBe(testMessage.channel);
    expect(receivedMessage.controller).toBe(testMessage.controller);
    expect(receivedMessage.value).toBe(testMessage.value);
  });

  test('should send and receive a program change message', async () => {
    const testMessage = {
      channel: 2,
      number: 42, // Program number
    };

    const messageReceived = new Promise<Message>((resolve) => {
      myInput.on('program', (msg) => {
        resolve(msg);
      });
    });

    myOutput.send('program', testMessage);

    const receivedMessage = await messageReceived;

    expect(receivedMessage.channel).toBe(testMessage.channel);
    expect(receivedMessage.number).toBe(testMessage.number);
  });

  test('should handle multiple messages in sequence', async () => {
    const messages = [
      { type: 'noteon', data: { channel: 0, note: 60, velocity: 127 } },
      { type: 'noteon', data: { channel: 0, note: 64, velocity: 100 } },
      { type: 'noteoff', data: { channel: 0, note: 60, velocity: 0 } },
      { type: 'noteoff', data: { channel: 0, note: 64, velocity: 0 } },
    ];

    const receivedMessages: Message[] = [];

    // Set up listeners for different message types
    myInput.on('noteon', (msg) => receivedMessages.push({ ...msg, _type: 'noteon' }));
    myInput.on('noteoff', (msg) => receivedMessages.push({ ...msg, _type: 'noteoff' }));

    // Send all messages
    for (const message of messages) {
      myOutput.send(message.type as any, message.data);
      // Small delay between messages
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Wait for all messages to be received
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(receivedMessages).toHaveLength(messages.length);

    // Verify each message
    for (let i = 0; i < messages.length; i++) {
      const sent = messages[i];
      const received = receivedMessages[i];

      expect(received._type).toBe(sent.type);
      expect(received.channel).toBe(sent.data.channel);
      expect(received.note).toBe(sent.data.note);

      if (sent.type === 'noteon') {
        expect(received.velocity).toBe(sent.data.velocity);
      }
    }
  });

  test('should handle sysex messages', async () => {
    const sysexData = [0xf0, 0x43, 0x12, 0x00, 0x43, 0x12, 0x00, 0xf7]; // Example sysex

    const messageReceived = new Promise<Message>((resolve) => {
      myInput.on('sysex', (msg) => {
        resolve(msg);
      });
    });

    myOutput.send('sysex', { bytes: sysexData });

    const receivedMessage = await messageReceived;

    expect(receivedMessage.bytes).toEqual(sysexData);
  });
});