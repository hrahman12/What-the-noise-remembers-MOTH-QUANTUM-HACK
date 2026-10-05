// TEST SHIM ONLY: minimal AudioBuffer / MidiMessage / MidiBuffer so FlavourEngine.h runs in tests.
#pragma once
#include <juce_core/juce_core.h>

namespace juce
{
template <typename T>
class AudioBuffer
{
public:
    AudioBuffer (int ch, int n) : data ((size_t) ch, std::vector<T> ((size_t) n, T())) {}
    int getNumChannels() const { return (int) data.size(); }
    int getNumSamples() const { return data.empty() ? 0 : (int) data[0].size(); }
    T* getWritePointer (int ch, int start = 0) { return data[(size_t) ch].data() + start; }
    void clear() { for (auto& c : data) std::fill (c.begin(), c.end(), T()); }
    std::vector<std::vector<T>> data;
};

class MidiMessage
{
public:
    enum Type { On, Off, AllOff };
    MidiMessage (Type t, int note, float vel) : type (t), nn (note), v (vel) {}
    bool isNoteOn() const { return type == On && v > 0; }
    bool isNoteOff() const { return type == Off || (type == On && v <= 0); }
    bool isAllNotesOff() const { return type == AllOff; }
    bool isAllSoundOff() const { return false; }
    int getNoteNumber() const { return nn; }
    float getFloatVelocity() const { return v; }
    Type type; int nn; float v;
};

struct MidiMessageMetadata
{
    MidiMessage msg; int samplePosition;
    MidiMessage getMessage() const { return msg; }
};

class MidiBuffer
{
public:
    void add (const MidiMessage& m, int pos) { events.push_back ({ m, pos }); }
    std::vector<MidiMessageMetadata>::const_iterator begin() const { return events.begin(); }
    std::vector<MidiMessageMetadata>::const_iterator end() const { return events.end(); }
    void clear() { events.clear(); }
    std::vector<MidiMessageMetadata> events;
};
} // namespace juce
