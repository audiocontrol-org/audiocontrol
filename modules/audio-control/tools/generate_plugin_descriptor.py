#!/usr/bin/env python3
"""
Plugin Descriptor Generator
Creates canonical plugin descriptor files from VST parameter extraction
"""
import sys
import json
try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False
import os
import time
from datetime import datetime
from typing import Dict, List, Any, Optional

# Add Carla to Python path
sys.path.append('/opt/homebrew/Cellar/carla/2.5.10/share/carla')

try:
    import carla_backend as carla
except ImportError:
    print("Error: Could not import Carla backend. Make sure Carla is installed.")
    sys.exit(1)


def categorize_parameter(param_name: str, param_index: int) -> str:
    """
    Categorize a parameter based on its name for better organization
    """
    name_lower = param_name.lower()

    # Master/Global controls
    if any(term in name_lower for term in ['master', 'volume', 'tune', 'octave', 'balance']):
        return 'master'

    # Voice/Polyphony controls
    if any(term in name_lower for term in ['voice', 'poly', 'unison', 'voices']):
        return 'voice'

    # Oscillator controls
    if any(term in name_lower for term in ['vco', 'osc', 'wave', 'sync', 'range', 'fine', 'x-mod']):
        return 'oscillator'

    # Filter controls
    if any(term in name_lower for term in ['filter', 'cutoff', 'resonance', 'hp', 'vcf']):
        return 'filter'

    # Envelope controls
    if any(term in name_lower for term in ['env', 'attack', 'decay', 'sustain', 'release', 'adsr']):
        return 'envelope'

    # LFO controls
    if any(term in name_lower for term in ['lfo', 'delay']):
        return 'lfo'

    # Modulation controls
    if any(term in name_lower for term in ['mod', 'pwm', 'cross']):
        return 'modulation'

    # VCA/Amplifier controls
    if any(term in name_lower for term in ['vca', 'amp', 'velocity']):
        return 'amplifier'

    # Effects controls
    if any(term in name_lower for term in ['fx', 'chorus', 'delay', 'reverb']):
        return 'effects'

    # Arpeggiator controls
    if any(term in name_lower for term in ['arp']):
        return 'arpeggiator'

    # MIDI controls
    if 'midi cc' in name_lower:
        return 'midi'

    # Portamento/Glide
    if any(term in name_lower for term in ['portamento', 'glide']):
        return 'portamento'

    # Hold/Sustain
    if any(term in name_lower for term in ['hold']):
        return 'control'

    # Default category
    return 'misc'


def determine_parameter_type(param: Dict[str, Any]) -> tuple[str, Optional[List[str]]]:
    """
    Determine parameter type based on its characteristics
    """
    name = param['name'].lower()
    min_val = param['min']
    max_val = param['max']

    # Boolean parameters (0.0 to 1.0 with likely on/off semantics)
    if min_val == 0.0 and max_val == 1.0 and any(term in name for term in ['on', 'off', 'enable', 'sync', 'hold', 'trigger']):
        return 'boolean', None

    # Choice parameters (discrete values with known semantics)
    if min_val == 0.0 and max_val == 1.0:
        if 'mode' in name or 'wave' in name or 'range' in name:
            return 'choice', None  # Would need plugin documentation for actual choices

    # Continuous parameters
    return 'continuous', None


def extract_plugin_descriptor(plugin_path: str, plugin_format: str = "VST3") -> Optional[Dict[str, Any]]:
    """
    Extract a complete plugin descriptor from a VST/AU plugin
    """
    # Create Carla host
    host = carla.CarlaHostDLL("/opt/homebrew/Cellar/carla/2.5.10/lib/carla/libcarla_standalone2.dylib", False)
    host.set_engine_option(carla.ENGINE_OPTION_PROCESS_MODE, carla.ENGINE_PROCESS_MODE_CONTINUOUS_RACK, "")

    if not host.engine_init("Dummy", "Plugin-Descriptor-Generator"):
        print(f"Error: Could not initialize Carla engine: {host.get_last_error()}")
        return None

    try:
        # Load plugin
        plugin_type = carla.PLUGIN_VST3 if plugin_format == "VST3" else carla.PLUGIN_AU
        success = host.add_plugin(carla.BINARY_NATIVE, plugin_type, plugin_path, "", "", 0, None, carla.PLUGIN_OPTIONS_NULL)

        if not success:
            print(f"Error: Could not load plugin: {host.get_last_error()}")
            return None

        plugin_id = 0
        time.sleep(0.5)  # Let plugin initialize

        # Get plugin info
        plugin_info = host.get_plugin_info(plugin_id)
        param_count = host.get_parameter_count(plugin_id)

        print(f"Generating descriptor for: {plugin_info['name']} ({plugin_format})")
        print(f"Parameters: {param_count}")

        # Extract all parameters
        parameters = []
        groups = {}

        for i in range(param_count):
            param_info = host.get_parameter_info(plugin_id, i)
            param_data = host.get_parameter_data(plugin_id, i)
            current_value = host.get_current_parameter_value(plugin_id, i)

            # Categorize parameter
            group = categorize_parameter(param_info['name'], i)
            param_type, choices = determine_parameter_type({
                'name': param_info['name'],
                'min': param_data.get('minimum', param_data.get('min', 0.0)),
                'max': param_data.get('maximum', param_data.get('max', 1.0))
            })

            parameter = {
                'index': i,
                'name': param_info['name'],
                'label': param_info.get('label', ''),
                'unit': param_info.get('unit', ''),
                'min': param_data.get('minimum', param_data.get('min', 0.0)),
                'max': param_data.get('maximum', param_data.get('max', 1.0)),
                'default': param_data.get('default', param_data.get('def', 0.0)),
                'group': group,
                'type': param_type,
                'automatable': True  # Assume all parameters are automatable
            }

            if choices:
                parameter['choices'] = choices

            parameters.append(parameter)

            # Build groups
            if group not in groups:
                groups[group] = {
                    'name': group.title(),
                    'parameters': []
                }
            groups[group]['parameters'].append(i)

        # Build descriptor
        now = datetime.now().isoformat()
        descriptor = {
            'plugin': {
                'manufacturer': plugin_info.get('maker', 'Unknown'),
                'name': plugin_info['name'],
                'version': '1.0.0',  # Would need more plugin introspection
                'format': plugin_format,
                'uid': str(plugin_info.get('uniqueId', 0))
            },
            'metadata': {
                'version': '1.0.0',
                'created': now,
                'updated': now,
                'author': 'Audio Control VST Parameter Extractor',
                'description': f'Auto-generated parameter descriptor for {plugin_info["name"]}',
                'tags': ['synthesizer'] if 'synth' in plugin_info['name'].lower() else ['effect']
            },
            'parameters': parameters,
            'groups': groups
        }

        return descriptor

    finally:
        host.remove_all_plugins()
        host.engine_close()


def find_plugin_by_name(plugin_name: str, prefer_format: str = None) -> tuple[Optional[str], str]:
    """Find plugin file path by name in standard plugin directories
    Returns: (path, format) tuple or (None, None) if not found"""

    # Check AU first if preferred or if VST3 fails
    au_paths = [
        "/Library/Audio/Plug-Ins/Components",
        os.path.expanduser("~/Library/Audio/Plug-Ins/Components")
    ]

    vst3_paths = [
        "/Library/Audio/Plug-Ins/VST3",
        "/usr/local/lib/vst3",
        os.path.expanduser("~/.vst3")
    ]

    # Try preferred format first
    if prefer_format == "AU":
        for base_path in au_paths:
            if os.path.exists(base_path):
                for item in os.listdir(base_path):
                    if plugin_name.lower() in item.lower() and item.endswith('.component'):
                        return os.path.join(base_path, item), "AU"

    # Try VST3
    for base_path in vst3_paths:
        if os.path.exists(base_path):
            for item in os.listdir(base_path):
                if plugin_name.lower() in item.lower() and item.endswith('.vst3'):
                    return os.path.join(base_path, item), "VST3"

    # Try AU as fallback
    if prefer_format != "AU":
        for base_path in au_paths:
            if os.path.exists(base_path):
                for item in os.listdir(base_path):
                    if plugin_name.lower() in item.lower() and item.endswith('.component'):
                        return os.path.join(base_path, item), "AU"

    return None, None


def main():
    if len(sys.argv) not in [2, 3, 4]:
        print("Usage: python3 generate_plugin_descriptor.py <plugin_name> [output_format] [--prefer-au]")
        print("Example: python3 generate_plugin_descriptor.py 'TAL-J-8' yaml")
        print("Example: python3 generate_plugin_descriptor.py 'Jup-8 V3' json --prefer-au")
        print("Output formats: yaml (default), json")
        sys.exit(1)

    plugin_name = sys.argv[1]
    output_format = 'yaml'
    prefer_au = False

    # Parse arguments
    for arg in sys.argv[2:]:
        if arg == '--prefer-au':
            prefer_au = True
        elif arg in ['yaml', 'json']:
            output_format = arg

    if output_format == 'yaml' and not HAS_YAML:
        print("Error: PyYAML not installed. Use 'json' format or install PyYAML")
        sys.exit(1)

    # Find plugin
    plugin_path, plugin_format = find_plugin_by_name(plugin_name, "AU" if prefer_au else None)
    if not plugin_path:
        print(f"Error: Could not find plugin '{plugin_name}' in plugin directories")
        sys.exit(1)

    print(f"Found plugin: {plugin_path} ({plugin_format})")

    # Generate descriptor
    descriptor = extract_plugin_descriptor(plugin_path, plugin_format)
    if not descriptor:
        print("Failed to generate plugin descriptor")
        sys.exit(1)

    # Generate output filename following project conventions
    # Format: manufacturer-plugin-name.format (e.g., tal-togu-audio-line-tal-j-8.json)
    manufacturer = descriptor['plugin']['manufacturer'].lower().replace(' ', '-').replace('.', '').replace(',', '')
    plugin_name_safe = descriptor['plugin']['name'].lower().replace('-', '-').replace(' ', '-')
    output_file = f"{manufacturer}-{plugin_name_safe}.{output_format}"

    # Write descriptor file
    with open(output_file, 'w') as f:
        if output_format == 'yaml':
            yaml.dump(descriptor, f, default_flow_style=False, sort_keys=False, indent=2)
        else:
            json.dump(descriptor, f, indent=2)

    print(f"Plugin descriptor written to: {output_file}")
    print(f"Parameters: {len(descriptor['parameters'])}")
    print(f"Groups: {list(descriptor['groups'].keys())}")


if __name__ == "__main__":
    main()