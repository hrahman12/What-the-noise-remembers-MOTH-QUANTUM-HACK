#include "PluginProcessor.h"
#include "PluginEditor.h"
#include <BinaryData.h>

FlavourData FlavourProcessor::loadData()
{
    FlavourData d;
    d.loadFromJson (BinaryData::flavour_curves_json, BinaryData::flavour_curves_jsonSize);
    return d;
}

juce::AudioProcessorValueTreeState::ParameterLayout FlavourProcessor::createLayout (const FlavourData& d)
{
    using namespace juce;
    AudioProcessorValueTreeState::ParameterLayout layout;

    NormalisableRange<float> leRange ((float) d.leMin, (float) d.leMax,
        [] (float s, float e, float t) { return s * std::pow (e / s, t); },
        [] (float s, float e, float v) { return std::log (v / s) / std::log (e / s); });
    layout.add (std::make_unique<AudioParameterFloat> (ParameterID { "le", 1 }, "L/E", leRange, 500.0f,
        AudioParameterFloatAttributes().withLabel ("km/GeV")
            .withStringFromValueFunction ([] (float v, int) { return String (roundToInt (v)) + " km/GeV"; })));

    StringArray chips;
    for (auto& m : d.machines)
        chips.add (m.label);
    layout.add (std::make_unique<AudioParameterChoice> (ParameterID { "chip", 1 }, "Chip", chips, 0));

    layout.add (std::make_unique<AudioParameterFloat> (ParameterID { "mix", 1 }, "Mix (exact to measured)",
        NormalisableRange<float> (0.0f, 1.0f), 1.0f));
    layout.add (std::make_unique<AudioParameterChoice> (ParameterID { "model", 1 }, "Model",
        StringArray { "3 flavours", "2 flavours" }, 0));
    layout.add (std::make_unique<AudioParameterFloat> (ParameterID { "flight", 1 }, "Flight",
        NormalisableRange<float> (0.0f, 0.5f), 0.0f,
        AudioParameterFloatAttributes().withLabel ("dec/s")));
    layout.add (std::make_unique<AudioParameterFloat> (ParameterID { "attack", 1 }, "Attack",
        NormalisableRange<float> (0.001f, 2.0f, 0.0f, 0.3f), 0.02f, AudioParameterFloatAttributes().withLabel ("s")));
    layout.add (std::make_unique<AudioParameterFloat> (ParameterID { "release", 1 }, "Release",
        NormalisableRange<float> (0.01f, 4.0f, 0.0f, 0.4f), 0.6f, AudioParameterFloatAttributes().withLabel ("s")));
    layout.add (std::make_unique<AudioParameterFloat> (ParameterID { "gain", 1 }, "Gain",
        NormalisableRange<float> (0.0f, 1.0f), 0.8f));
    return layout;
}

FlavourProcessor::FlavourProcessor()
    : AudioProcessor (BusesProperties().withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      data (loadData()),
      apvts (*this, nullptr, "FLAVOUR", createLayout (data))
{
}

void FlavourProcessor::prepareToPlay (double sampleRate, int)
{
    engine.prepare (sampleRate);
    keyboardState.reset();
}

bool FlavourProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto out = layouts.getMainOutputChannelSet();
    return out == juce::AudioChannelSet::mono() || out == juce::AudioChannelSet::stereo();
}

flavour::Params FlavourProcessor::currentParams() const
{
    flavour::Params p;
    auto get = [this] (const char* id) { return apvts.getRawParameterValue (id)->load(); };
    p.u = std::log10 ((double) juce::jlimit ((float) data.leMin, (float) data.leMax, get ("le")));
    p.chip = juce::jlimit (0, (int) data.machines.size() - 1, (int) get ("chip"));
    p.mix = get ("mix");
    p.model = ((int) get ("model")) == 0 ? 3 : 2;
    p.flight = get ("flight");
    p.attack = get ("attack");
    p.release = get ("release");
    p.gain = get ("gain");
    return p;
}

void FlavourProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi)
{
    juce::ScopedNoDenormals noDenormals;
    buffer.clear();
    keyboardState.processNextMidiBuffer (midi, 0, buffer.getNumSamples(), true);
    const auto p = currentParams();
    engine.render (buffer, midi, p, data);
    displayU.store (engine.voiceU (p, data));
}

void FlavourProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    if (auto xml = apvts.copyState().createXml())
        copyXmlToBinary (*xml, destData);
}

void FlavourProcessor::setStateInformation (const void* bytes, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (bytes, sizeInBytes))
        if (xml->hasTagName (apvts.state.getType()))
            apvts.replaceState (juce::ValueTree::fromXml (*xml));
}

juce::AudioProcessorEditor* FlavourProcessor::createEditor()
{
    return new FlavourEditor (*this);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new FlavourProcessor();
}
