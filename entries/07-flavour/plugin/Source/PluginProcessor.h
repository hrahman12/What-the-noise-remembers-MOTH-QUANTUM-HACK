#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_audio_utils/juce_audio_utils.h>
#include "FlavourData.h"
#include "FlavourEngine.h"

class FlavourProcessor : public juce::AudioProcessor
{
public:
    FlavourProcessor();
    ~FlavourProcessor() override = default;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    using juce::AudioProcessor::processBlock;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return "FLAVOUR"; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 4.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return "Default"; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    flavour::Params currentParams() const;

    FlavourData data;                         // declared before apvts: the chip list comes from it
    juce::AudioProcessorValueTreeState apvts;
    juce::MidiKeyboardState keyboardState;    // the on-screen keyboard in the editor
    std::atomic<double> displayU { 2.7 };     // L/E of the newest sounding voice, for the editor

private:
    static FlavourData loadData();
    static juce::AudioProcessorValueTreeState::ParameterLayout createLayout (const FlavourData&);
    flavour::Engine engine;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (FlavourProcessor)
};
