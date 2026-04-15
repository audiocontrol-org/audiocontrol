import { test } from '@playwright/test';

/**
 * Deep protocol debugging test for S-330 RJC issue
 *
 * The S-330 is responding with RJC (rejection) even though patches are loaded.
 * This test tries different approaches to diagnose why.
 */
test('debug S-330 protocol - RJC investigation', async ({ page }) => {
  // Collect all console messages
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log('[PAGE ERROR]', err.message);
  });

  await page.goto('/');
  await page.waitForTimeout(2000);

  console.log('\n=== SELECTING MIDI PORTS ===\n');

  // Select Volt 4 input
  const inputTrigger = page.locator('text=MIDI Input').locator('..').locator('button');
  await inputTrigger.click();
  await page.waitForTimeout(300);
  await page.locator('[role="option"]').filter({ hasText: 'Volt 4' }).first().click();
  await page.waitForTimeout(300);

  // Select Volt 4 output
  const outputTrigger = page.locator('text=MIDI Output').locator('..').locator('button');
  await outputTrigger.click();
  await page.waitForTimeout(300);
  await page.locator('[role="option"]').filter({ hasText: 'Volt 4' }).first().click();
  await page.waitForTimeout(300);

  // Device ID 1 on display = 0 in protocol (already default)
  console.log('\n=== DEVICE ID SET TO 1 (display) = 0 (protocol) ===\n');

  console.log('\n=== CONNECTING ===\n');
  await page.click('button:has-text("Connect")');
  await page.waitForTimeout(1000);

  // Inject diagnostic code into the page
  console.log('\n=== RUNNING PROTOCOL DIAGNOSTICS ===\n');

  const result = await page.evaluate(async () => {
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
      console.log(msg);
    };

    // Get the MIDI access
    const access = await navigator.requestMIDIAccess({ sysex: true });

    // Find Volt 4 ports
    let input: MIDIInput | null = null;
    let output: MIDIOutput | null = null;

    access.inputs.forEach((port) => {
      if (port.name?.includes('Volt 4')) input = port;
    });
    access.outputs.forEach((port) => {
      if (port.name?.includes('Volt 4')) output = port;
    });

    if (!input || !output) {
      return { logs: ['ERROR: Volt 4 ports not found'], success: false };
    }

    await input.open();
    await output.open();

    const ROLAND_ID = 0x41;
    const S330_MODEL = 0x1E;
    const deviceId = 0x00; // Display "1" = Protocol 0

    // Commands
    const RQD = 0x41;
    const WSD = 0x40;
    const DAT = 0x42;
    const ACK = 0x43;
    const EOD = 0x45;
    const ERR = 0x4E;
    const RJC = 0x4F;

    const cmdName = (cmd: number) => {
      switch(cmd) {
        case RQD: return 'RQD';
        case WSD: return 'WSD';
        case DAT: return 'DAT';
        case ACK: return 'ACK';
        case EOD: return 'EOD';
        case ERR: return 'ERR';
        case RJC: return 'RJC';
        default: return `0x${cmd.toString(16)}`;
      }
    };

    // Helper to send and receive
    const sendAndReceive = (message: number[], timeoutMs = 2000): Promise<number[] | null> => {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          input!.removeEventListener('midimessage', listener);
          resolve(null);
        }, timeoutMs);

        function listener(e: MIDIMessageEvent) {
          if (e.data && e.data[0] === 0xF0) {
            clearTimeout(timeout);
            input!.removeEventListener('midimessage', listener);
            resolve(Array.from(e.data));
          }
        }

        input!.addEventListener('midimessage', listener);
        output!.send(new Uint8Array(message));
      });
    };

    // Test 1: Try WSD first to check if device is in transfer-waiting state
    log('\n--- TEST 1: Check WSD state (type 0x00 = All Data) ---');
    {
      const dataType = 0x00;
      const checksum = (128 - dataType) & 0x7F;
      const msg = [0xF0, ROLAND_ID, deviceId, S330_MODEL, WSD, dataType, checksum, 0xF7];
      log(`TX: ${msg.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

      const response = await sendAndReceive(msg);
      if (response) {
        const cmd = response[4];
        log(`RX: ${response.map(b => b.toString(16).padStart(2, '0')).join(' ')} (${cmdName(cmd)})`);
        if (cmd === ACK) {
          log('   S-330 sent ACK - it was waiting for data! Sending EOD to cancel...');
          // Send EOD to cancel the transfer
          const eodMsg = [0xF0, ROLAND_ID, deviceId, S330_MODEL, EOD, 0xF7];
          output!.send(new Uint8Array(eodMsg));
          await new Promise(r => setTimeout(r, 500));
        }
      } else {
        log('   No response');
      }
    }

    // Give device time to reset state
    await new Promise(r => setTimeout(r, 1000));

    // Test 2: Try RQD type 0x05 (Function params) - should always have data
    log('\n--- TEST 2: RQD type 0x05 (Function params) ---');
    {
      const dataType = 0x05;
      const checksum = (128 - dataType) & 0x7F;
      const msg = [0xF0, ROLAND_ID, deviceId, S330_MODEL, RQD, dataType, checksum, 0xF7];
      log(`TX: ${msg.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

      const response = await sendAndReceive(msg);
      if (response) {
        const cmd = response[4];
        log(`RX: ${response.map(b => b.toString(16).padStart(2, '0')).join(' ')} (${cmdName(cmd)})`);
      } else {
        log('   No response');
      }
    }

    await new Promise(r => setTimeout(r, 500));

    // Test 3: Try different device IDs
    log('\n--- TEST 3: Try different device IDs with RQD type 0x01 ---');
    for (const devId of [0x00, 0x01, 0x10]) {
      const dataType = 0x01;
      const checksum = (128 - dataType) & 0x7F;
      const msg = [0xF0, ROLAND_ID, devId, S330_MODEL, RQD, dataType, checksum, 0xF7];
      log(`DeviceID ${devId}: TX: ${msg.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

      const response = await sendAndReceive(msg, 1000);
      if (response) {
        const respDevId = response[2];
        const cmd = response[4];
        log(`           RX: ${response.map(b => b.toString(16).padStart(2, '0')).join(' ')} (${cmdName(cmd)}) - device says ID=${respDevId}`);
      } else {
        log('           No response');
      }
      await new Promise(r => setTimeout(r, 300));
    }

    // Test 4: Try RQD with longer timeout and wait for multiple messages
    log('\n--- TEST 4: RQD type 0x01 with longer timeout ---');
    {
      const dataType = 0x01;
      const checksum = (128 - dataType) & 0x7F;
      const msg = [0xF0, ROLAND_ID, deviceId, S330_MODEL, RQD, dataType, checksum, 0xF7];
      log(`TX: ${msg.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

      const messages: number[][] = [];
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          input!.removeEventListener('midimessage', listener);
          resolve();
        }, 5000);

        function listener(e: MIDIMessageEvent) {
          if (e.data && e.data[0] === 0xF0) {
            const data = Array.from(e.data);
            messages.push(data);
            const cmd = data[4];
            log(`RX[${messages.length}]: ${data.slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join(' ')}... (${cmdName(cmd)})`);

            // If we got EOD or RJC or ERR, we're done
            if (cmd === EOD || cmd === RJC || cmd === ERR) {
              clearTimeout(timeout);
              input!.removeEventListener('midimessage', listener);
              resolve();
            }
          }
        }

        input!.addEventListener('midimessage', listener);
        output!.send(new Uint8Array(msg));
      });

      log(`   Total messages received: ${messages.length}`);
    }

    await input.close();
    await output.close();

    return { logs, success: true };
  });

  console.log('\n=== DIAGNOSTIC RESULTS ===\n');
  result.logs.forEach(l => console.log(l));

  console.log('\n=== KEEPING BROWSER OPEN 10s ===\n');
  await page.waitForTimeout(10000);
});
