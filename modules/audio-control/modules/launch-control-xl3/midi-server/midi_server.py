#!/usr/bin/env python3
"""
MIDI Server using python-rtmidi for reliable SysEx handling
Provides HTTP API for Node.js tests to interact with MIDI devices
"""

import rtmidi
import time
import json
import threading
import queue
from flask import Flask, request, jsonify
from flask_cors import CORS
from typing import Dict, List, Optional, Tuple
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

class MidiPort:
    """Wrapper for MIDI input/output port with message queuing"""

    def __init__(self, port_name: str, port_type: str):
        self.port_name = port_name
        self.port_type = port_type
        self.midi_obj = None
        self.port_index = None
        self.message_queue = queue.Queue()
        self.is_open = False

    def open(self):
        """Open the MIDI port"""
        if self.port_type == 'input':
            self.midi_obj = rtmidi.MidiIn()
        else:
            self.midi_obj = rtmidi.MidiOut()

        # Find the port index
        ports = self.midi_obj.get_ports()
        for i, port in enumerate(ports):
            if self.port_name in port:
                self.port_index = i
                break

        if self.port_index is None:
            raise ValueError(f"Port '{self.port_name}' not found")

        # Open the port
        self.midi_obj.open_port(self.port_index)

        # Set up callback for input ports
        if self.port_type == 'input':
            self.midi_obj.set_callback(self._on_message)

        self.is_open = True
        logger.info(f"Opened {self.port_type} port: {self.port_name}")

    def close(self):
        """Close the MIDI port"""
        if self.midi_obj:
            self.midi_obj.close_port()
            self.is_open = False
            logger.info(f"Closed {self.port_type} port: {self.port_name}")

    def send(self, message: List[int]):
        """Send a MIDI message (output ports only)"""
        if self.port_type != 'output':
            raise ValueError("Cannot send on input port")
        if not self.is_open:
            raise ValueError("Port is not open")

        self.midi_obj.send_message(message)
        logger.debug(f"Sent to {self.port_name}: {' '.join(f'{b:02X}' for b in message)}")

    def get_messages(self, timeout: float = 0) -> List[List[int]]:
        """Get all queued messages"""
        messages = []
        deadline = time.time() + timeout

        while True:
            try:
                remaining = max(0, deadline - time.time()) if timeout > 0 else 0
                msg = self.message_queue.get(timeout=remaining)
                messages.append(msg)
                self.message_queue.task_done()
            except queue.Empty:
                break

        return messages

    def _on_message(self, midi_event, data=None):
        """Callback for incoming MIDI messages"""
        message, delta_time = midi_event
        self.message_queue.put(list(message))
        logger.debug(f"Received on {self.port_name}: {' '.join(f'{b:02X}' for b in message)}")


class MidiServer:
    """MIDI server managing multiple ports"""

    def __init__(self):
        self.ports: Dict[str, MidiPort] = {}
        self.lock = threading.Lock()

    def list_ports(self) -> Dict[str, List[str]]:
        """List all available MIDI ports"""
        midi_in = rtmidi.MidiIn()
        midi_out = rtmidi.MidiOut()

        return {
            'inputs': midi_in.get_ports(),
            'outputs': midi_out.get_ports()
        }

    def open_port(self, port_id: str, port_name: str, port_type: str) -> bool:
        """Open a MIDI port"""
        with self.lock:
            if port_id in self.ports:
                self.ports[port_id].close()

            port = MidiPort(port_name, port_type)
            try:
                port.open()
                self.ports[port_id] = port
                return True
            except Exception as e:
                logger.error(f"Failed to open port {port_name}: {e}")
                return False

    def close_port(self, port_id: str) -> bool:
        """Close a MIDI port"""
        with self.lock:
            if port_id in self.ports:
                self.ports[port_id].close()
                del self.ports[port_id]
                return True
            return False

    def send_message(self, port_id: str, message: List[int]) -> bool:
        """Send a message to an output port"""
        with self.lock:
            if port_id not in self.ports:
                return False
            try:
                self.ports[port_id].send(message)
                return True
            except Exception as e:
                logger.error(f"Failed to send message: {e}")
                return False

    def get_messages(self, port_id: str, timeout: float = 0) -> List[List[int]]:
        """Get messages from an input port"""
        with self.lock:
            if port_id not in self.ports:
                return []
            return self.ports[port_id].get_messages(timeout)


# Global server instance
midi_server = MidiServer()


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})


@app.route('/ports', methods=['GET'])
def list_ports():
    """List available MIDI ports"""
    return jsonify(midi_server.list_ports())


@app.route('/port/<port_id>', methods=['POST'])
def open_port(port_id):
    """Open a MIDI port"""
    data = request.json
    port_name = data.get('name')
    port_type = data.get('type')

    if not port_name or not port_type:
        return jsonify({'error': 'Missing name or type'}), 400

    if port_type not in ['input', 'output']:
        return jsonify({'error': 'Invalid port type'}), 400

    success = midi_server.open_port(port_id, port_name, port_type)
    return jsonify({'success': success})


@app.route('/port/<port_id>', methods=['DELETE'])
def close_port(port_id):
    """Close a MIDI port"""
    success = midi_server.close_port(port_id)
    return jsonify({'success': success})


@app.route('/port/<port_id>/send', methods=['POST'])
def send_message(port_id):
    """Send a MIDI message"""
    data = request.json
    message = data.get('message')

    if not message:
        return jsonify({'error': 'Missing message'}), 400

    success = midi_server.send_message(port_id, message)
    return jsonify({'success': success})


@app.route('/port/<port_id>/messages', methods=['GET'])
def get_messages(port_id):
    """Get received messages from an input port"""
    timeout = float(request.args.get('timeout', 0))
    messages = midi_server.get_messages(port_id, timeout)
    return jsonify({'messages': messages})


@app.route('/test/lcxl3', methods=['POST'])
def test_lcxl3():
    """Test complete LCXL3 protocol with slot selection and SysEx"""
    try:
        # Open all required ports
        midi_server.open_port('midi_out', 'LCXL3 1 MIDI In', 'output')
        midi_server.open_port('midi_in', 'LCXL3 1 MIDI Out', 'input')
        midi_server.open_port('daw_out', 'LCXL3 1 DAW In', 'output')
        midi_server.open_port('daw_in', 'LCXL3 1 DAW Out', 'input')

        time.sleep(0.1)  # Let ports settle

        results = []

        # Test handshake
        logger.info("Testing handshake...")
        midi_server.send_message('midi_out', [0xF0, 0x00, 0x20, 0x29, 0x00, 0x42, 0x02, 0xF7])
        time.sleep(0.2)

        responses = midi_server.get_messages('midi_in')
        for resp in responses:
            if resp[0] == 0xF0 and len(resp) > 7:
                serial = ''.join(chr(b) for b in resp[7:-1] if b < 128)
                results.append(f"Handshake OK - Serial: {serial}")
                logger.info(f"Handshake successful - Serial: {serial}")
                break

        # Test slot selection
        for slot in range(3):
            logger.info(f"Testing slot {slot}...")
            cc_value = slot + 6

            # Query current slot
            midi_server.send_message('daw_out', [0x9F, 11, 127])
            time.sleep(0.01)
            midi_server.send_message('daw_out', [0xB7, 30, 0])
            time.sleep(0.05)

            daw_responses = midi_server.get_messages('daw_in')
            current_slot = None
            for resp in daw_responses:
                if resp[0] == 0xB6 and resp[1] == 30:
                    current_slot = resp[2] - 6
                    break

            midi_server.send_message('daw_out', [0x9F, 11, 0])
            time.sleep(0.05)

            # Set target slot
            midi_server.send_message('daw_out', [0x9F, 11, 127])
            time.sleep(0.01)
            midi_server.send_message('daw_out', [0xB6, 30, cc_value])
            time.sleep(0.01)
            midi_server.send_message('daw_out', [0x9F, 11, 0])
            time.sleep(0.1)

            # Read from slot
            read_msg = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x40, 0x00, slot, 0xF7]
            midi_server.send_message('midi_out', read_msg)
            time.sleep(0.5)

            responses = midi_server.get_messages('midi_in')
            for resp in responses:
                if resp[0] == 0xF0 and len(resp) > 20 and resp[8] == 0x10:
                    # Extract name from response
                    if len(resp) > 30:
                        name_bytes = resp[14:30]
                        name = ''.join(chr(b) for b in name_bytes if 32 <= b < 127).strip()
                        results.append(f"Slot {slot}: current={current_slot}, read_name='{name}'")
                        logger.info(f"Slot {slot} read successful - Name: '{name}'")
                    break

        # Clean up
        midi_server.close_port('midi_out')
        midi_server.close_port('midi_in')
        midi_server.close_port('daw_out')
        midi_server.close_port('daw_in')

        return jsonify({
            'success': True,
            'results': results
        })

    except Exception as e:
        logger.error(f"Test failed: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    logger.info("Starting MIDI Server on port 5000...")
    app.run(host='0.0.0.0', port=5000, debug=False)