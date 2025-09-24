#!/usr/bin/env python3
"""
VST Plugin Parameter Extractor using Carla
Extracts parameter names and indices from VST/AU plugins
"""
import sys
import os
import time

# Add Carla to Python path
sys.path.append('/opt/homebrew/Cellar/carla/2.5.10/share/carla')

try:
    import carla_backend as carla
except ImportError:
    print("Error: Could not import Carla backend. Make sure Carla is installed.")
    sys.exit(1)


def extract_plugin_parameters(plugin_path, plugin_format="VST3"):
    """
    Extract parameters from a VST/AU plugin using Carla

    Args:
        plugin_path: Path to plugin file
        plugin_format: Plugin format (VST3, AU, etc.)

    Returns:
        List of parameter dictionaries
    """
    # Create Carla host - use CarlaHostDLL for proper functionality
    host = carla.CarlaHostDLL("/opt/homebrew/Cellar/carla/2.5.10/lib/carla/libcarla_standalone2.dylib", False)

    # Set process mode before initialization
    host.set_engine_option(carla.ENGINE_OPTION_PROCESS_MODE, carla.ENGINE_PROCESS_MODE_CONTINUOUS_RACK, "")

    # Initialize engine with minimal settings (no audio device needed for parameter inspection)
    if not host.engine_init("Dummy", "VST-Parameter-Extractor"):
        print(f"Error: Could not initialize Carla engine: {host.get_last_error()}")
        return []

    try:
        # Load plugin
        # add_plugin(btype, ptype, filename, name, label, uniqueId, extraPtr, options)
        plugin_type = carla.PLUGIN_VST3 if plugin_format == "VST3" else carla.PLUGIN_AU
        success = host.add_plugin(carla.BINARY_NATIVE, plugin_type, plugin_path, "", "", 0, None, carla.PLUGIN_OPTIONS_NULL)

        if not success:
            print(f"Error: Could not load plugin from {plugin_path}: {host.get_last_error()}")
            return []

        plugin_id = 0  # First plugin loaded has ID 0

        # Wait a moment for plugin to initialize
        time.sleep(0.5)

        # Get plugin info
        plugin_info = host.get_plugin_info(plugin_id)
        plugin_name = plugin_info['name']
        param_count = host.get_parameter_count(plugin_id)

        print(f"Plugin: {plugin_name} ({plugin_format})")
        print(f"Parameters: {param_count}")

        parameters = []

        # Extract all parameters
        for i in range(param_count):
            param_info = host.get_parameter_info(plugin_id, i)
            param_data = host.get_parameter_data(plugin_id, i)
            current_value = host.get_current_parameter_value(plugin_id, i)

            parameters.append({
                'index': i,
                'name': param_info['name'],
                'label': param_info.get('label', ''),
                'unit': param_info.get('unit', ''),
                'min': param_data.get('minimum', param_data.get('min', 0.0)),
                'max': param_data.get('maximum', param_data.get('max', 1.0)),
                'default': param_data.get('default', param_data.get('def', 0.0)),
                'current': current_value
            })

        return parameters

    finally:
        # Clean up
        host.remove_all_plugins()
        host.engine_close()

    return []


def find_plugin_by_name(plugin_name):
    """Find plugin file path by name in standard VST3 directories"""
    vst3_paths = [
        "/Library/Audio/Plug-Ins/VST3",
        "/usr/local/lib/vst3",
        os.path.expanduser("~/.vst3")
    ]

    for base_path in vst3_paths:
        if os.path.exists(base_path):
            for item in os.listdir(base_path):
                if plugin_name.lower() in item.lower() and item.endswith('.vst3'):
                    return os.path.join(base_path, item)

    return None


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 extract_vst_parameters.py <plugin_name>")
        print("Example: python3 extract_vst_parameters.py 'TAL-J-8'")
        sys.exit(1)

    plugin_name = sys.argv[1]

    # Find plugin
    plugin_path = find_plugin_by_name(plugin_name)
    if not plugin_path:
        print(f"Error: Could not find plugin '{plugin_name}' in VST3 directories")
        sys.exit(1)

    print(f"Found plugin: {plugin_path}")

    # Extract parameters
    parameters = extract_plugin_parameters(plugin_path)

    if not parameters:
        print("No parameters found or plugin failed to load")
        sys.exit(1)

    # Output parameters in format useful for canonical maps
    print("\n=== Plugin Parameters ===")
    for param in parameters:
        print(f"Index {param['index']:2d}: {param['name']} ({param['label']}) [{param['min']:.2f} - {param['max']:.2f}] = {param['current']:.2f}")


if __name__ == "__main__":
    main()