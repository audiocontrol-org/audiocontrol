import { test } from '@playwright/test';

/**
 * Standalone protocol debugging - doesn't navigate away from home page
 */
test('standalone S-330 protocol debug', async ({ page }) => {
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  await page.goto('/');
  await page.waitForTimeout(2000);

  console.log('\n=== RUNNING STANDALONE PROTOCOL DIAGNOSTICS ===\n');

  const result = await page.evaluate(async () => {
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
      console.log(msg);
    };

    log('Getting MIDI access...');
    const access = await navigator.requestMIDIAccess({ sysex: true });

    let input: MIDIInput | null = null;
    let output: MIDIOutput | null = null;

    access.inputs.forEach((port) => {
      if (port.name?.includes('Volt 4')) input = port;
    });
    access.outputs.forEach((port) => {
      if (port.name?.includes('Volt 4')) output = port;
    });

    if (!input || !output) {
      log('ERROR: Volt 4 ports not found');
      return { logs, success: false };
    }

    log(`Found input: ${input.name}`);
    log(`Found output: ${output.name}`);

    await input.open();
    await output.open();
    log('Ports opened');

    const ROLAND = 0x41;
    const MODEL = 0x1E;

    const RQD = 0x41, WSD = 0x40, DAT = 0x42, ACK = 0x43, EOD = 0x45, ERR = 0x4E, RJC = 0x4F;

    const cmdName = (c: number) => ({
      [RQD]: 'RQD', [WSD]: 'WSD', [DAT]: 'DAT', [ACK]: 'ACK',
      [EOD]: 'EOD', [ERR]: 'ERR', [RJC]: 'RJC'
    }[c] || `0x${c.toString(16)}`);

    const sendAndWait = (msg: number[], timeout = 2000): Promise<number[] | null> => {
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          input!.removeEventListener('midimessage', handler);
          resolve(null);
        }, timeout);

        function handler(e: MIDIMessageEvent) {
          if (e.data && e.data[0] === 0xF0) {
            clearTimeout(timer);
            input!.removeEventListener('midimessage', handler);
            resolve(Array.from(e.data));
          }
        }

        input!.addEventListener('midimessage', handler);
        output!.send(new Uint8Array(msg));
      });
    };

    const hex = (arr: number[]) => arr.map(b => b.toString(16).padStart(2, '0')).join(' ');

    // Test 1: WSD to check/reset state
    log('\n=== TEST 1: WSD 0x00 (All Data) - check if device is stuck waiting ===');
    {
      const type = 0x00;
      const cs = (128 - type) & 0x7F;
      const msg = [0xF0, ROLAND, 0x00, MODEL, WSD, type, cs, 0xF7];
      log(`TX: ${hex(msg)}`);

      const resp = await sendAndWait(msg);
      if (resp) {
        const cmd = resp[4];
        log(`RX: ${hex(resp)} - ${cmdName(cmd)}`);
        if (cmd === ACK) {
          log('Device sent ACK - was waiting for data! Sending EOD to reset...');
          output!.send(new Uint8Array([0xF0, ROLAND, 0x00, MODEL, EOD, 0xF7]));
          await new Promise(r => setTimeout(r, 1000));
          log('Sent EOD, waiting...');
        }
      } else {
        log('No response to WSD');
      }
    }

    await new Promise(r => setTimeout(r, 500));

    // Test 2: RQD Function params (type 0x05)
    log('\n=== TEST 2: RQD 0x05 (Function params) - should always exist ===');
    {
      const type = 0x05;
      const cs = (128 - type) & 0x7F;
      const msg = [0xF0, ROLAND, 0x00, MODEL, RQD, type, cs, 0xF7];
      log(`TX: ${hex(msg)}`);

      const resp = await sendAndWait(msg);
      if (resp) {
        const cmd = resp[4];
        log(`RX: ${hex(resp.slice(0, 15))}... (len=${resp.length}) - ${cmdName(cmd)}`);
      } else {
        log('No response');
      }
    }

    await new Promise(r => setTimeout(r, 500));

    // Test 3: RQD Patch 1-32 (type 0x01)
    log('\n=== TEST 3: RQD 0x01 (Patch 1-32) ===');
    {
      const type = 0x01;
      const cs = (128 - type) & 0x7F;
      const msg = [0xF0, ROLAND, 0x00, MODEL, RQD, type, cs, 0xF7];
      log(`TX: ${hex(msg)}`);

      const resp = await sendAndWait(msg);
      if (resp) {
        const cmd = resp[4];
        log(`RX: ${hex(resp.slice(0, 15))}... (len=${resp.length}) - ${cmdName(cmd)}`);
      } else {
        log('No response');
      }
    }

    await new Promise(r => setTimeout(r, 500));

    // Test 4: RQD Tone 1-32 (type 0x03)
    log('\n=== TEST 4: RQD 0x03 (Tone 1-32) ===');
    {
      const type = 0x03;
      const cs = (128 - type) & 0x7F;
      const msg = [0xF0, ROLAND, 0x00, MODEL, RQD, type, cs, 0xF7];
      log(`TX: ${hex(msg)}`);

      const resp = await sendAndWait(msg);
      if (resp) {
        const cmd = resp[4];
        log(`RX: ${hex(resp.slice(0, 15))}... (len=${resp.length}) - ${cmdName(cmd)}`);
      } else {
        log('No response');
      }
    }

    await new Promise(r => setTimeout(r, 500));

    // Test 5: Try device ID 0x10 (corresponds to display "17")
    log('\n=== TEST 5: RQD with different device IDs ===');
    for (const devId of [0x00, 0x01, 0x10]) {
      const type = 0x01;
      const cs = (128 - type) & 0x7F;
      const msg = [0xF0, ROLAND, devId, MODEL, RQD, type, cs, 0xF7];
      log(`TX (dev=${devId}): ${hex(msg)}`);

      const resp = await sendAndWait(msg, 1000);
      if (resp) {
        const respDev = resp[2];
        const cmd = resp[4];
        log(`RX: ${hex(resp)} - ${cmdName(cmd)} (device replied as ${respDev})`);
      } else {
        log('No response');
      }
      await new Promise(r => setTimeout(r, 300));
    }

    await input.close();
    await output.close();

    return { logs, success: true };
  });

  console.log('\n=== RESULTS ===');
  for (const line of result.logs) {
    console.log(line);
  }

  console.log('\n=== DONE ===\n');
  await page.waitForTimeout(5000);
});
