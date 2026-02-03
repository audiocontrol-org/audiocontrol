import type { ArdourMidiMap, ArdourBinding, ArdourDeviceInfo } from '../types/ardour.js';

export interface XMLSerializerOptions {
  indent?: string;
  newline?: string;
}

export class ArdourXMLSerializer {
  private readonly indent: string;
  private readonly newline: string;

  constructor(options: XMLSerializerOptions = {}) {
    this.indent = options.indent ?? '  ';
    this.newline = options.newline ?? '\n';
  }

  serializeMidiMap(midiMap: ArdourMidiMap): string {
    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<ArdourMIDIBindings version="1.0.0" name="${this.escapeXML(midiMap.name)}">`,
    ];

    // Add DeviceInfo if present
    if (midiMap.deviceInfo) {
      lines.push(this.serializeDeviceInfoElement(midiMap.deviceInfo));
    }

    // Serialize binding groups with comments if available
    if (midiMap.bindingGroups && midiMap.bindingGroups.length > 0) {
      for (const group of midiMap.bindingGroups) {
        // Add comment for the group
        if (group.comment) {
          lines.push(this.indent + `<!-- ${this.escapeXML(group.comment)} -->`);
        }

        // Add all bindings in this group
        for (const binding of group.bindings) {
          lines.push(this.indent + this.serializeBinding(binding));
        }

        // Add empty line between groups for readability
        if (group !== midiMap.bindingGroups[midiMap.bindingGroups.length - 1]) {
          lines.push('');
        }
      }
    }

    // Add any ungrouped bindings
    for (const binding of midiMap.bindings.filter(binding =>
      !midiMap.bindingGroups?.some(group => group.bindings.includes(binding))
    )) {
      lines.push(this.indent + this.serializeBinding(binding));
    }

    lines.push('</ArdourMIDIBindings>');
    return lines.join(this.newline);
  }

  serializeDeviceInfo(deviceInfo: ArdourDeviceInfo): string {
    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<DeviceInfo name="${this.escapeXML(deviceInfo['device-name'])}">`,
    ];

    const info = deviceInfo['device-info'];
    const attributes: string[] = [];

    for (const [key, value] of Object.entries(info)) {
      if (value !== undefined) {
        attributes.push(`${key}="${value}"`);
      }
    }

    if (attributes.length > 0) {
      lines.push(`${this.indent}<GlobalButtons ${attributes.join(' ')}/>`);
    }

    lines.push('</DeviceInfo>');
    return lines.join(this.newline);
  }

  private serializeDeviceInfoElement(deviceInfo: ArdourDeviceInfo): string {
    const info = deviceInfo['device-info'];
    const attributes: string[] = [];

    for (const [key, value] of Object.entries(info)) {
      if (value !== undefined) {
        attributes.push(`${key}="${value}"`);
      }
    }

    return `<DeviceInfo ${attributes.join(' ')}/>`;
  }

  private serializeBinding(binding: ArdourBinding): string {
    const attributes: string[] = [];

    attributes.push(`channel="${binding.channel}"`);

    if (binding.ctl !== undefined) {
      attributes.push(`ctl="${binding.ctl}"`);
    }
    if (binding.note !== undefined) {
      attributes.push(`note="${binding.note}"`);
    }
    if (binding['enc-r'] !== undefined) {
      attributes.push(`enc-r="${binding['enc-r']}"`);
    }
    if (binding.rpn !== undefined) {
      attributes.push(`rpn="${binding.rpn}"`);
    }
    if (binding.nrpn !== undefined) {
      attributes.push(`nrpn="${binding.nrpn}"`);
    }
    if (binding.rpn14 !== undefined) {
      attributes.push(`rpn-14="${binding.rpn14}"`);
    }
    if (binding.nrpn14 !== undefined) {
      attributes.push(`nrpn-14="${binding.nrpn14}"`);
    }

    if (binding.function) {
      attributes.push(`function="${this.escapeXML(binding.function)}"`);
    }
    if (binding.uri) {
      attributes.push(`uri="${this.escapeXML(binding.uri)}"`);
    }

    if (binding.action) {
      attributes.push(`action="${this.escapeXML(binding.action)}"`);
    }
    if (binding.encoder) {
      attributes.push(`encoder="${binding.encoder}"`);
    }
    if (binding.momentary) {
      attributes.push(`momentary="${binding.momentary}"`);
    }
    if (binding.threshold !== undefined) {
      attributes.push(`threshold="${binding.threshold}"`);
    }

    return `<Binding ${attributes.join(' ')}/>`;
  }

  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  parseMidiMap(_xml: string): ArdourMidiMap {
    throw new Error('XML parsing not yet implemented');
  }
}