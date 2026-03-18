import { test } from '@playwright/test';

/**
 * Test RQ1 vs RQD for requesting individual parameters
 *
 * Try both command formats to see which one the S-330 responds to.
 */
test('test RQ1 and RQD for individual parameter requests', async ({ page }) => {
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  await page.goto('/');
  await page.waitForTimeout(2000);

  console.log('\n=== TESTING RQ1 vs RQD FOR PARAMETER REQUESTS ===\n');

  const result = await page.evaluate(async () => {
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(msg);
      console.log(msg);
    };

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
      return { logs };
    }

    await input.open();
    await output.open();
    log('Ports opened');

    const ROLAND = 0x41;
    const MODEL = 0x1E;
    const deviceId = 0x00;

    const RQ1 = 0x11;  // Data Request (address + size)
    const RQD = 0x41;  // Request Data (bulk/type based?)
    const DT1 = 0x12;  // Data Set
    const DAT = 0x42;
    const ACK = 0x43;
    const RJC = 0x4F;
    const ERR = 0x4E;

    const hex = (arr: number[]) => arr.map(b => b.toString(16).padStart(2, '0')).join(' ');

    // Roland checksum: 128 - (sum of data bytes) & 0x7F
    const checksum = (data: number[]) => (128 - data.reduce((a, b) => a + b, 0) % 128) % 128;

    const sendAndWait = (msg: number[], timeout = 3000): Promise<number[] | null> => {
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
        log(`TX: ${hex(msg)}`);
        output!.send(new Uint8Array(msg));
      });
    };

    // Address for Patch 0 Name: 00 01 00 00 (8 bytes)
    const patchNameAddr = [0x00, 0x01, 0x00, 0x00];
    const patchNameSize = [0x00, 0x00, 0x00, 0x08];

    // ============================================
    // TEST 1: RQ1 (0x11) with address + size
    // ============================================
    log('\n=== TEST 1: RQ1 (0x11) - Request Patch 0 Name ===');
    log('Format: F0 41 dev 1E 11 [addr] [size] [checksum] F7');
    {
      const addrAndSize = [...patchNameAddr, ...patchNameSize];
      const cs = checksum(addrAndSize);
      const msg = [0xF0, ROLAND, deviceId, MODEL, RQ1, ...addrAndSize, cs, 0xF7];

      const resp = await sendAndWait(msg);
      if (resp) {
        const cmd = resp[4];
        const cmdName = cmd === DAT ? 'DAT' : cmd === RJC ? 'RJC' : cmd === ERR ? 'ERR' : cmd === DT1 ? 'DT1' : `0x${cmd.toString(16)}`;
        log(`RX: ${hex(resp.slice(0, 20))}${resp.length > 20 ? '...' : ''} (${cmdName}, len=${resp.length})`);

        if (cmd === DT1 && resp.length > 10) {
          // DT1 response contains the data
          const data = resp.slice(5, -2); // address + data before checksum
          log(`Data received: ${hex(data)}`);
          // Try to decode as ASCII
          const nameBytes = data.slice(4, 12); // Skip 4-byte address
          const name = nameBytes.map(b => b >= 0x20 && b < 0x7F ? String.fromCharCode(b) : '.').join('');
          log(`Patch name: "${name}"`);
        }
      } else {
        log('No response (timeout)');
      }
    }

    await new Promise(r => setTimeout(r, 500));

    // ============================================
    // TEST 2: RQD (0x41) with address + size (experimental)
    // ============================================
    log('\n=== TEST 2: RQD (0x41) with address + size (experimental) ===');
    log('Format: F0 41 dev 1E 41 [addr] [size] [checksum] F7');
    {
      const addrAndSize = [...patchNameAddr, ...patchNameSize];
      const cs = checksum(addrAndSize);
      const msg = [0xF0, ROLAND, deviceId, MODEL, RQD, ...addrAndSize, cs, 0xF7];

      const resp = await sendAndWait(msg);
      if (resp) {
        const cmd = resp[4];
        const cmdName = cmd === DAT ? 'DAT' : cmd === RJC ? 'RJC' : cmd === ERR ? 'ERR' : cmd === ACK ? 'ACK' : `0x${cmd.toString(16)}`;
        log(`RX: ${hex(resp.slice(0, 20))}${resp.length > 20 ? '...' : ''} (${cmdName}, len=${resp.length})`);
      } else {
        log('No response (timeout)');
      }
    }

    await new Promise(r => setTimeout(r, 500));

    // ============================================
    // TEST 3: Request System Parameter (Master Tune)
    // ============================================
    log('\n=== TEST 3: RQ1 - Request System Parameter (Master Tune) ===');
    log('Address: 00 00 00 00, Size: 1 byte');
    {
      const addr = [0x00, 0x00, 0x00, 0x00];
      const size = [0x00, 0x00, 0x00, 0x01];
      const addrAndSize = [...addr, ...size];
      const cs = checksum(addrAndSize);
      const msg = [0xF0, ROLAND, deviceId, MODEL, RQ1, ...addrAndSize, cs, 0xF7];

      const resp = await sendAndWait(msg);
      if (resp) {
        const cmd = resp[4];
        const cmdName = cmd === DAT ? 'DAT' : cmd === RJC ? 'RJC' : cmd === ERR ? 'ERR' : cmd === DT1 ? 'DT1' : `0x${cmd.toString(16)}`;
        log(`RX: ${hex(resp)} (${cmdName})`);
      } else {
        log('No response (timeout)');
      }
    }

    await new Promise(r => setTimeout(r, 500));

    // ============================================
    // TEST 4: Request Tone 0 Name
    // ============================================
    log('\n=== TEST 4: RQ1 - Request Tone 0 Name ===');
    log('Address: 00 02 00 00, Size: 8 bytes');
    {
      const addr = [0x00, 0x02, 0x00, 0x00];
      const size = [0x00, 0x00, 0x00, 0x08];
      const addrAndSize = [...addr, ...size];
      const cs = checksum(addrAndSize);
      const msg = [0xF0, ROLAND, deviceId, MODEL, RQ1, ...addrAndSize, cs, 0xF7];

      const resp = await sendAndWait(msg);
      if (resp) {
        const cmd = resp[4];
        const cmdName = cmd === DAT ? 'DAT' : cmd === RJC ? 'RJC' : cmd === ERR ? 'ERR' : cmd === DT1 ? 'DT1' : `0x${cmd.toString(16)}`;
        log(`RX: ${hex(resp.slice(0, 20))}${resp.length > 20 ? '...' : ''} (${cmdName}, len=${resp.length})`);
      } else {
        log('No response (timeout)');
      }
    }

    await input.close();
    await output.close();

    return { logs };
  });

  console.log('\n=== SUMMARY ===');
  for (const line of result.logs) {
    console.log(line);
  }

  await page.waitForTimeout(3000);
});
