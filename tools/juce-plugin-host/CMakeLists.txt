juce_add_console_app(plughost
        PRODUCT_NAME "OL Juce Plugin Host"
        PLUGINHOST_AU TRUE
        FORMATS Standalone VST3 AU
)
target_sources(plughost
        PRIVATE
        host.cpp
)
target_compile_definitions(plughost
        PRIVATE
        JUCE_PLUGINHOST_LV2=1
        JUCE_PLUGINHOST_VST3=1
        # JUCE_WEB_BROWSER and JUCE_USE_CURL would be on by default, but you might not need them.
        JUCE_WEB_BROWSER=0  # If you remove this, add `NEEDS_WEB_BROWSER TRUE` to the `juce_add_console_app` call
        JUCE_USE_CURL=0)

target_link_libraries(plughost
        PRIVATE
        # ConsoleAppData            # If you'd created a binary data target, you'd link to it here
        ol_corelib
        juce::juce_core
        juce::juce_audio_devices
        juce::juce_audio_processors
        juce::juce_osc
        PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_warning_flags)
