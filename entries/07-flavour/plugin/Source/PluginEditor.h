#pragma once

#include "PluginProcessor.h"

namespace flavourui
{
// The Neutrino Gelateria's paper-and-ink palette (the same tokens as the web page).
const juce::Colour paper { 0xfffbfaf9 }, panel { 0xffffffff }, panel2 { 0xfff0f0f4 }, rule { 0xffd3d3e6 },
                   ink { 0xff19238e }, ink2 { 0xff545ba9 }, warn { 0xffb4541a }, good { 0xff1f7a4d };
}

// The recipe card: the flavour curves measured in the chosen kitchen (dots) over the exact classical
// curves (lines). Drag across it to walk the scoop's journey (L/E).
class CurveView : public juce::Component
{
public:
    explicit CurveView (FlavourProcessor& p) : proc (p) {}
    void paint (juce::Graphics&) override;
    void mouseDown (const juce::MouseEvent& e) override;
    void mouseDrag (const juce::MouseEvent& e) override;
    void mouseUp (const juce::MouseEvent&) override;

private:
    juce::Rectangle<float> plotArea() const;
    void setFromX (float x);
    FlavourProcessor& proc;
};

class FlavourEditor : public juce::AudioProcessorEditor, private juce::Timer
{
public:
    explicit FlavourEditor (FlavourProcessor&);
    ~FlavourEditor() override;
    void paint (juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;
    void knob (juce::Slider& s, juce::Label& l, const juce::String& name);

    FlavourProcessor& proc;
    CurveView curve;
    juce::Slider le, mix, flight, attack, release, gain;
    juce::Label leL, mixL, flightL, attackL, releaseL, gainL, chipL, modelL, info;
    juce::ComboBox chip, model;
    juce::MidiKeyboardComponent keyboard;

    using SA = juce::AudioProcessorValueTreeState::SliderAttachment;
    using CA = juce::AudioProcessorValueTreeState::ComboBoxAttachment;
    std::unique_ptr<SA> leA, mixA, flightA, attackA, releaseA, gainA;
    std::unique_ptr<CA> chipA, modelA;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (FlavourEditor)
};
