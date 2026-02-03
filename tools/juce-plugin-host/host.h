//
// Created by Orion Letizi on 3/26/25.
//
#pragma once
#include <iostream>
#include <juce_gui_basics/juce_gui_basics.h>
#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_osc/juce_osc.h>

#ifndef HOST_H
#define HOST_H

namespace ol::jucehost {
    struct ControlMapConfig {
        const juce::String parameterName;
        const int midiCC;
        const juce::String oscPath;
    };

    struct PluginConfig {
        juce::String format;
        juce::String name;
        std::vector<ControlMapConfig *> controlMaps;
    };

    struct HostConfig {
        juce::String midiInputDevice, audioInputDevice, audioOutputDevice;
        std::vector<PluginConfig *> plugins;
        std::vector<juce::String> ignore;
        int inputChannelCount = 2;
        int outputChannelCount = 2;
        double sampleRate = 44100;
        int bufferSize = 128;
    };

    struct ControlChange {
        juce::AudioProcessorParameter *parameter;
        float value;
    };

    class OLJuceHost final : public juce::JUCEApplication,
                             public juce::AudioIODeviceCallback,
                             public juce::MidiInputCallback,
                             public juce::OSCReceiver::Listener<juce::OSCReceiver::MessageLoopCallback> {
    public:
        const juce::String getApplicationName() override;

        const juce::String getApplicationVersion() override;


        void parseConfigLine(const juce::String &line);

        void initialise(const juce::String &commandLineParameters) override;

        void shutdown() override;

        void audioDeviceAboutToStart(juce::AudioIODevice *device) override;

        void audioDeviceIOCallbackWithContext(const float *const*inputChannelData, int numInputChannels,
                                              float *const*outputChannelData, int numOutputChannels, int
                                              numSamples, const juce::AudioIODeviceCallbackContext &context) override;

        void audioDeviceStopped() override;

        void mapControls();

        void handleIncomingMidiMessage(juce::MidiInput *source, const juce::MidiMessage &message) override;

        void oscMessageReceived(const juce::OSCMessage &message) override;

    private:
        static juce::String parseDeviceName(const juce::String &line);


    private:
        HostConfig config;
        juce::AudioDeviceManager deviceManager;
        juce::AudioPluginFormatManager formatManager;
        juce::OSCReceiver oscReceiver;
        juce::KnownPluginList knownPlugins;
        std::vector<std::unique_ptr<juce::AudioPluginInstance> > instances;
        juce::AudioBuffer<float> audioBuffer;
        std::map<int, juce::AudioProcessorParameter *> ccMap;
        std::map<juce::String, juce::AudioProcessorParameter *> oscMap;
        std::queue<ControlChange *> controlChanges;
        std::mutex q_mutex;
        int count = 0;
    };
}
#endif //HOST_H
START_JUCE_APPLICATION(ol::jucehost::OLJuceHost)
