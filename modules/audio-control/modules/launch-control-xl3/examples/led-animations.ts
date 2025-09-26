/**
 * LED Animations Example
 *
 * Demonstrates various LED control capabilities and animations
 */

import { LaunchControlXL3, LED_COLOR_VALUES } from '../src';

async function main() {
  console.log('Launch Control XL 3 - LED Animations Example');
  console.log('='.repeat(50));

  const controller = new LaunchControlXL3({
    autoConnect: true,
    enableLedControl: true,
  });

  try {
    await controller.initialize();
    console.log('✓ Connected to device\n');

    // Example 1: Individual LED control
    console.log('1. Setting individual LEDs...');
    await controller.setLed('FOCUS1', LED_COLOR_VALUES.RED_FULL);
    await controller.setLed('FOCUS2', LED_COLOR_VALUES.AMBER_FULL);
    await controller.setLed('FOCUS3', LED_COLOR_VALUES.YELLOW_FULL);
    await controller.setLed('FOCUS4', LED_COLOR_VALUES.GREEN_FULL);
    await delay(2000);

    // Example 2: Flash effect
    console.log('2. Flashing LEDs...');
    for (let i = 1; i <= 8; i++) {
      await controller.flashLed(`CONTROL${i}`, LED_COLOR_VALUES.RED_FULL, 200);
      await delay(100);
    }
    await delay(1000);

    // Example 3: Pulse effect
    console.log('3. Pulsing LEDs...');
    for (let i = 1; i <= 8; i++) {
      await controller.setLed(`FOCUS${i}`, LED_COLOR_VALUES.AMBER_FULL, 'pulse');
    }
    await delay(3000);

    // Example 4: Rainbow animation
    console.log('4. Rainbow animation...');
    controller.startLedAnimation('rainbow', {
      type: 'rainbow',
      duration: 5000,
      controls: [
        'FOCUS1', 'FOCUS2', 'FOCUS3', 'FOCUS4',
        'FOCUS5', 'FOCUS6', 'FOCUS7', 'FOCUS8'
      ],
      repeat: 3,
    });
    await delay(5000);

    // Example 5: Chase animation
    console.log('5. Chase animation...');
    controller.startLedAnimation('chase', {
      type: 'chase',
      duration: 3000,
      controls: [
        'CONTROL1', 'CONTROL2', 'CONTROL3', 'CONTROL4',
        'CONTROL5', 'CONTROL6', 'CONTROL7', 'CONTROL8'
      ],
      colors: [LED_COLOR_VALUES.GREEN_FULL],
      repeat: 5,
    });
    await delay(3000);

    // Example 6: Custom animation
    console.log('6. Custom animation...');
    let frame = 0;
    controller.startLedAnimation('custom', {
      type: 'custom',
      duration: 3000,
      callback: async (f) => {
        frame = f;
        const index = f % 8;

        // Turn off previous LED
        if (index > 0) {
          await controller.turnOffLed(`FOCUS${index}`);
        }

        // Turn on current LED
        await controller.setLed(`FOCUS${index + 1}`,
          frame % 2 === 0 ? LED_COLOR_VALUES.GREEN_FULL : LED_COLOR_VALUES.AMBER_FULL
        );
      },
    });
    await delay(3000);

    // Clean up
    console.log('\nTurning off all LEDs...');
    await controller.turnOffAllLeds();

    console.log('✓ Animation demo complete');
    await controller.cleanup();

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the example
main().catch(console.error);