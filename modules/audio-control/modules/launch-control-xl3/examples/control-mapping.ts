/**
 * Control Mapping Example
 *
 * Demonstrates advanced control mapping with value transformations
 */

import { LaunchControlXL3, ValueTransformers } from '../src';

async function main() {
  console.log('Launch Control XL 3 - Control Mapping Example');
  console.log('='.repeat(50));

  const controller = new LaunchControlXL3({
    autoConnect: true,
    enableValueSmoothing: true,
    smoothingFactor: 3,
  });

  try {
    await controller.initialize();
    console.log('✓ Connected to device\n');

    // Example 1: Linear mapping (default)
    console.log('1. Setting up linear mapping for Send A knobs...');
    for (let i = 1; i <= 8; i++) {
      controller.mapControl(`SEND_A${i}`, 0, (10 + i) as any, {
        min: 0,
        max: 127,
        behaviour: 'absolute',
      });
    }

    // Example 2: Exponential mapping (good for volume)
    console.log('2. Setting up exponential mapping for faders...');
    for (let i = 1; i <= 8; i++) {
      controller.mapControl(`FADER${i}`, 0, (80 + i) as any, {
        min: 0,
        max: 127,
        behaviour: 'absolute',
        transform: {
          type: 'exponential',
          curve: 2.5, // Higher curve = more dramatic exponential
        },
      });
    }

    // Example 3: Logarithmic mapping
    console.log('3. Setting up logarithmic mapping for Send B knobs...');
    for (let i = 1; i <= 4; i++) {
      controller.mapControl(`SEND_B${i}`, 0, (30 + i) as any, {
        min: 0,
        max: 127,
        behaviour: 'absolute',
        transform: {
          type: 'logarithmic',
        },
      });
    }

    // Example 4: Stepped mapping (quantized values)
    console.log('4. Setting up stepped mapping for Send B5-8...');
    for (let i = 5; i <= 8; i++) {
      controller.mapControl(`SEND_B${i}`, 0, (30 + i) as any, {
        min: 0,
        max: 127,
        behaviour: 'absolute',
        transform: {
          type: 'stepped',
          steps: 8, // Quantize to 8 discrete values
        },
      });
    }

    // Example 5: Relative mappings for Pan knobs
    console.log('5. Setting up relative mappings for Pan knobs...');
    controller.mapControl('PAN1', 0, 50, {
      min: 0,
      max: 127,
      behaviour: 'relative1', // Two's complement
    });

    controller.mapControl('PAN2', 0, 51, {
      min: 0,
      max: 127,
      behaviour: 'relative2', // Binary offset
    });

    controller.mapControl('PAN3', 0, 52, {
      min: 0,
      max: 127,
      behaviour: 'relative3', // Sign magnitude
    });

    // Example 6: Toggle mapping
    console.log('6. Setting up toggle mapping for Pan4...');
    controller.mapControl('PAN4', 0, 53, {
      min: 0,
      max: 127,
      behaviour: 'absolute',
      transform: {
        type: 'toggle',
        threshold: 64, // Values >= 64 become 127, < 64 become 0
      },
    });

    // Example 7: Inverted mapping
    console.log('7. Setting up inverted mapping for Pan5...');
    controller.mapControl('PAN5', 0, 54, {
      min: 0,
      max: 127,
      behaviour: 'absolute',
      transform: {
        type: 'invert', // 0 becomes 127, 127 becomes 0
      },
    });

    // Example 8: Bipolar mapping
    console.log('8. Setting up bipolar mapping for Pan6...');
    controller.mapControl('PAN6', 0, 55, {
      min: -64,
      max: 63,
      behaviour: 'absolute',
      transform: {
        type: 'bipolar', // Center at 0, range -64 to +63
      },
    });

    // Monitor control changes
    console.log('\n📊 Control Value Transformations:');
    console.log('─'.repeat(50));
    console.log('Move controls to see transformed values...');
    console.log('(Values will be smoothed due to smoothing enabled)\n');

    controller.on('control:change', (controlId, rawValue) => {
      const mapping = controller.getControlMapping(controlId);
      if (mapping && mapping.transform) {
        // Calculate transformed value for display
        let transformed = rawValue;

        switch (mapping.transform.type) {
          case 'exponential':
            transformed = ValueTransformers.exponential(rawValue, mapping.min, mapping.max, mapping.transform.curve);
            break;
          case 'logarithmic':
            transformed = ValueTransformers.logarithmic(rawValue, mapping.min, mapping.max);
            break;
          case 'stepped':
            transformed = ValueTransformers.stepped(rawValue, mapping.min, mapping.max, mapping.transform.steps!);
            break;
          case 'toggle':
            transformed = ValueTransformers.toggle(rawValue, mapping.transform.threshold);
            break;
          case 'invert':
            transformed = ValueTransformers.invert(rawValue);
            break;
          case 'bipolar':
            transformed = ValueTransformers.bipolar(rawValue);
            break;
        }

        const bar = '█'.repeat(Math.round((transformed / 127) * 10));
        const empty = '░'.repeat(10 - bar.length);

        console.log(
          `${controlId.padEnd(8)} │ ` +
          `Raw: ${rawValue.toString().padStart(3)} │ ` +
          `${mapping.transform.type.padEnd(12)} │ ` +
          `Out: ${transformed.toString().padStart(3)} │ ` +
          `[${bar}${empty}]`
        );
      }
    });

    // Keep alive for 30 seconds
    console.log('\nMonitoring for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log('\n✓ Control mapping demo complete');
    await controller.cleanup();

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);