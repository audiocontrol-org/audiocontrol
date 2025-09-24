#include <juce_audio_utils/juce_audio_utils.h>

using namespace juce;

class PluginHost : public AudioAppComponent
{
public:
    PluginHost(const String& pluginName, const String& inputDevice, const String& outputDevice)
        : pluginNameToLoad(pluginName)
    {
        formatManager.addDefaultFormats();
        deviceManager.initialise(1, 2, nullptr, true, inputDevice, outputDevice);

        RuntimePermissions::request(RuntimePermissions::recordAudio, [&](bool granted) {
            if (granted)
                initialisePlugin();
        });
    }

    ~PluginHost() override
    {
        if (pluginInstance)
            pluginInstance->releaseResources();
    }

    void prepareToPlay(int samplesPerBlockExpected, double sampleRate) override
    {
        if (pluginInstance)
            pluginInstance->prepareToPlay(sampleRate, samplesPerBlockExpected);
    }

    void getNextAudioBlock(const AudioSourceChannelInfo& bufferToFill) override
    {
        if (pluginInstance)
        {
            MidiBuffer midi;
            pluginInstance->processBlock(*bufferToFill.buffer, midi);
        }
        else
        {
            bufferToFill.clearActiveBufferRegion();
        }
    }

    void releaseResources() override
    {
        if (pluginInstance)
            pluginInstance->releaseResources();
    }

private:
    AudioPluginFormatManager formatManager;
    std::unique_ptr<AudioPluginInstance> pluginInstance;
    String pluginNameToLoad;

    void initialisePlugin()
    {
        PluginDirectoryScanner scanner(formatManager, knownPluginList,
                                       FileSearchPath(), true, File(), false);

        while (scanner.scanNextFile(true))
        {
            auto desc = scanner.getLastDescription();

            if (desc.name.containsIgnoreCase(pluginNameToLoad))
            {
                String error;
                pluginInstance.reset(formatManager.createPluginInstance(
                    *desc, deviceManager.getCurrentAudioDevice()->getCurrentSampleRate(),
                    512, error));

                if (pluginInstance != nullptr)
                {
                    pluginInstance->prepareToPlay(getSampleRate(), getBlockSize());
                    setAudioChannels(1, 2);
                    DBG("Plugin loaded: " << pluginNameToLoad);
                }
                else
                {
                    DBG("Failed to create plugin instance: " << error);
                }

                break;
            }
        }

        if (pluginInstance == nullptr)
            DBG("Plugin not found: " << pluginNameToLoad);
    }

    KnownPluginList knownPluginList;
};

//==============================================================================
int main(int argc, char* argv[])
{
    if (argc < 4)
    {
        std::cout << "Usage: PluginHost <plugin_name> <input_device_name> <output_device_name>" << std::endl;
        return 1;
    }

    const String pluginName(argv[1]);
    const String inputDevice(argv[2]);
    const String outputDevice(argv[3]);

    ConsoleApplication app;
    PluginHost host(pluginName, inputDevice, outputDevice);
    MessageManager::getInstance()->runDispatchLoop();

    return 0;
}
