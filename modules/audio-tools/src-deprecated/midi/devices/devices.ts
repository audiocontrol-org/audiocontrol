// GENERATED: 11/21/2024, 1:47:21 PM
// DO NOT EDIT. YOUR CHANGES WILL BE OVERWRITTEN.

import {MutableNumber, MutableString, Result, NumberResult, StringResult} from "@/lib/lib-core"
import {AkaiS56kSysex} from "@/midi/akai-s56k-sysex"
import {newDeviceObject} from "@/midi/device"
import {ProcessOutput} from "@/process-output"
import {programOutputSpec,programMidTuneSpec,programPitchBendSpec,programLfosSpec} from "@/midi/devices/specs"

//
// ProgramOutput
//

export interface ProgramOutputInfo {
  loudness: MutableNumber
  velocitySensitivity: MutableNumber
  ampMod1Source: MutableNumber
  ampMod2Source: MutableNumber
  ampMod1Value: MutableNumber
  ampMod2Value: MutableNumber
  panMod1Source: MutableNumber
  panMod2Source: MutableNumber
  panMod3source: MutableNumber
  panMod1Value: MutableNumber
  panMod2Value: MutableNumber
  panMod3Value: MutableNumber
}

export interface ProgramOutputInfoResult extends Result {
  data: ProgramOutputInfo
}


export interface ProgramOutput {
  getLoudness(): NumberResult
  getVelocitySensitivity(): NumberResult
  getAmpMod1Source(): NumberResult
  getAmpMod2Source(): NumberResult
  getAmpMod1Value(): NumberResult
  getAmpMod2Value(): NumberResult
  getPanMod1Source(): NumberResult
  getPanMod2Source(): NumberResult
  getPanMod3source(): NumberResult
  getPanMod1Value(): NumberResult
  getPanMod2Value(): NumberResult
  getPanMod3Value(): NumberResult
  getInfo(): Promise<ProgramOutputInfoResult>
}


export function newProgramOutput(sysex: AkaiS56kSysex, out: ProcessOutput) {
  return newDeviceObject(programOutputSpec, sysex, out) as ProgramOutput}

//
// ProgramMidiTune
//

export interface ProgramMidiTuneInfo {
  semitoneTune: MutableNumber
  fineTune: MutableNumber
  tuneTemplate: MutableNumber
  key: MutableNumber
}

export interface ProgramMidiTuneInfoResult extends Result {
  data: ProgramMidiTuneInfo
}


export interface ProgramMidiTune {
  getSemitoneTune(): NumberResult
  getFineTune(): NumberResult
  getTuneTemplate(): NumberResult
  getKey(): NumberResult
  getInfo(): Promise<ProgramMidiTuneInfoResult>
}


export function newProgramMidiTune(sysex: AkaiS56kSysex, out: ProcessOutput) {
  return newDeviceObject(programMidTuneSpec, sysex, out) as ProgramMidiTune}

//
// ProgramPitchBend
//

export interface ProgramPitchBendInfo {
  pitchBendUp: MutableNumber
  pitchBendDown: MutableNumber
  bendMode: MutableNumber
  aftertouchValue: MutableNumber
  legatoEnable: MutableNumber
  portamentoEnable: MutableNumber
  portamentoMode: MutableNumber
  portamentoTime: MutableNumber
}

export interface ProgramPitchBendInfoResult extends Result {
  data: ProgramPitchBendInfo
}


export interface ProgramPitchBend {
  getPitchBendUp(): NumberResult
  getPitchBendDown(): NumberResult
  getBendMode(): NumberResult
  getAftertouchValue(): NumberResult
  getLegatoEnable(): NumberResult
  getPortamentoEnable(): NumberResult
  getPortamentoMode(): NumberResult
  getPortamentoTime(): NumberResult
  getInfo(): Promise<ProgramPitchBendInfoResult>
}


export function newProgramPitchBend(sysex: AkaiS56kSysex, out: ProcessOutput) {
  return newDeviceObject(programPitchBendSpec, sysex, out) as ProgramPitchBend}

//
// ProgramLfos
//

export interface ProgramLfosInfo {
  lfo1Rate: MutableNumber
  lfo2Rate: MutableNumber
  lfo1Delay: MutableNumber
  lfo2Delay: MutableNumber
  lfo1Depth: MutableNumber
  lfo2Depth: MutableNumber
  lfo1Waveform: MutableNumber
  lfo2Waveform: MutableNumber
  lfo1Sync: MutableNumber
  lfo2Retrigger: MutableNumber
  lfo1RateModSource: MutableNumber
}

export interface ProgramLfosInfoResult extends Result {
  data: ProgramLfosInfo
}


export interface ProgramLfos {
  getLfo1Rate(): NumberResult
  getLfo2Rate(): NumberResult
  getLfo1Delay(): NumberResult
  getLfo2Delay(): NumberResult
  getLfo1Depth(): NumberResult
  getLfo2Depth(): NumberResult
  getLfo1Waveform(): NumberResult
  getLfo2Waveform(): NumberResult
  getLfo1Sync(): NumberResult
  getLfo2Retrigger(): NumberResult
  getLfo1RateModSource(): NumberResult
  getInfo(): Promise<ProgramLfosInfoResult>
}


export function newProgramLfos(sysex: AkaiS56kSysex, out: ProcessOutput) {
  return newDeviceObject(programLfosSpec, sysex, out) as ProgramLfos}

