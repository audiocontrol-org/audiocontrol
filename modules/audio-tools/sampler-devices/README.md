# Sampler Devices

Binary format parsers for hardware sampler program files.

![sampler-devices](https://github.com/oletizi/ol_dsp/actions/workflows/sampler-devices.yml/badge.svg)

npm i [@oletizi/sampler-devices](https://www.npmjs.com/package/@oletizi/sampler-devices)

## Features

* **Akai S3000xl** - Read and write program files
* **Akai S5000/S6000** - Parse and modify `.AKP` program files
* Pure TypeScript - No native dependencies

## Special Thanks

* [Hiroyuki Ohsaki for akaitools](https://www.lsnl.jp/~ohsaki/software/akaitools/)
* [Seb Francis for reverse engineering the Akai S5000/S6000 program format](https://burnit.co.uk/AKPspec/)

## MIDI Communication

For MIDI hardware communication, see [@oletizi/sampler-midi](https://www.npmjs.com/package/@oletizi/sampler-midi)
