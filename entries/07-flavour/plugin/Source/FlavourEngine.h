// FLAVOUR synth engine. Same algorithm as synth.py (the Python replica) and web/template.html.
//
// Per voice, per chunk of up to kBlock samples:
//   u      = log10(L/E): the L/E knob plus FLIGHT (decades/s) x seconds since note-on, clamped
//   curve  = (1 - MIX) * exact + MIX * the chosen chip's measured curve
//   level  = curve(u) for each flavour, clamped to [0, 1]
//   wave   = a window of the same curve (kWin decades, kNWin points) around u, mean removed, mirrored
//            into a 2*kNWin cycle and divided by its peak. Its harmonics 1..min(63, 0.45 sr / f) are
//            rebuilt on a kTab-sample table (band-limited).
// Oscillators: e at 1.5 f, mu at f (the note you play), tau at 0.5 f. Linear attack / release.
#pragma once

#include "FlavourData.h"
#include <juce_audio_basics/juce_audio_basics.h>
#include <array>
#include <cmath>

namespace flavour
{
constexpr int kNWin = 64;            // window samples
constexpr int kCycle = 2 * kNWin;    // mirrored cycle length
constexpr int kMaxH = 63;            // harmonics kept
constexpr int kTab = 256;            // wavetable length
constexpr int kBlock = 256;          // control-rate chunk
constexpr int kVoices = 8;
constexpr double kWin = 0.5;         // window width in decades of L/E
constexpr double kTwoPi = 6.283185307179586;
constexpr float kMult[3] = { 1.5f, 1.0f, 0.5f };   // e, mu, tau

struct Params
{
    double u = 2.7;        // log10(L/E)
    int chip = 0;
    float mix = 1.0f;
    int model = 3;         // 3 or 2 flavours
    float flight = 0.0f;   // decades per second
    float attack = 0.02f, release = 0.6f, gain = 0.8f;
};

struct Trig
{
    float c128[kCycle], s128[kCycle], c256[kTab], s256[kTab];
    Trig()
    {
        for (int i = 0; i < kCycle; ++i) { c128[i] = (float) std::cos (kTwoPi * i / kCycle); s128[i] = (float) std::sin (kTwoPi * i / kCycle); }
        for (int i = 0; i < kTab; ++i)   { c256[i] = (float) std::cos (kTwoPi * i / kTab);   s256[i] = (float) std::sin (kTwoPi * i / kTab); }
    }
};

inline const Trig& trig() { static const Trig t; return t; }

// Harmonics 1..kMaxH of the mirrored window cycle (numpy rfft convention), divided by the cycle's peak.
inline void cycleSpectrum (const FlavourData& d, const Params& p, int flav, double u, float* re, float* im)
{
    float s[kNWin], cyc[kCycle];
    double mean = 0.0;
    for (int j = 0; j < kNWin; ++j)
    {
        const double uj = u + ((double) j / (kNWin - 1) - 0.5) * kWin;
        s[j] = d.flavourCurve (p.chip, p.mix, p.model, flav, uj);
        mean += s[j];
    }
    mean /= kNWin;
    float peak = 0.0f;
    for (int j = 0; j < kNWin; ++j)
    {
        const float w = (float) (s[j] - mean);
        cyc[j] = w;
        cyc[kCycle - 1 - j] = w;
        peak = std::max (peak, std::abs (w));
    }
    if (peak < 1e-9f)   // perfectly flat window: unit sine
    {
        for (int h = 0; h < kMaxH; ++h) { re[h] = 0.0f; im[h] = 0.0f; }
        im[0] = -(float) kNWin;
        return;
    }
    const auto& T = trig();
    for (int h = 1; h <= kMaxH; ++h)
    {
        float a = 0.0f, b = 0.0f;
        for (int t = 0; t < kCycle; ++t)
        {
            const int k = (h * t) & (kCycle - 1);
            a += cyc[t] * T.c128[k];
            b -= cyc[t] * T.s128[k];
        }
        re[h - 1] = a / peak;
        im[h - 1] = b / peak;
    }
}

inline void buildTable (const float* re, const float* im, int hmax, float* table)
{
    const auto& T = trig();
    const int H = juce::jlimit (1, kMaxH, hmax);
    const float k = 2.0f / (float) kCycle;
    for (int t = 0; t < kTab; ++t)
    {
        float acc = 0.0f;
        for (int h = 1; h <= H; ++h)
        {
            const int i = (h * t) & (kTab - 1);
            acc += re[h - 1] * T.c256[i] - im[h - 1] * T.s256[i];
        }
        table[t] = k * acc;
    }
}

struct Voice
{
    bool active = false, releasing = false;
    int note = -1;
    float vel = 0.0f, env = 0.0f, relStep = 0.0f;
    double freq = 440.0, age = 0.0;
    double phase[3] = { 0, 0, 0 };
    float level[3] = { 0, 0, 0 };
    float table[3][kTab] {};
    // what the tables were last built for
    double lastU = -99.0; int lastChip = -1, lastModel = -1, lastH[3] = { -1, -1, -1 }; float lastMix = -1.0f;
    bool fresh = true;

    void start (int midiNote, float velocity)
    {
        active = true; releasing = false; note = midiNote; vel = velocity;
        freq = 440.0 * std::pow (2.0, (midiNote - 69) / 12.0);
        age = 0.0; env = 0.0f; fresh = true; lastU = -99.0;
        for (auto& ph : phase) ph = 0.0;
    }

    void stop (const Params& p, double sr)
    {
        releasing = true;
        relStep = env / (float) std::max (1.0, (double) p.release * sr);
    }

    void render (float* out, int n, const Params& p, const FlavourData& d, double sr)
    {
        const double u = std::min (d.umax, p.u + (double) p.flight * age);
        const bool changed = std::abs (u - lastU) > 1e-6 || p.chip != lastChip || p.model != lastModel
                             || std::abs (p.mix - lastMix) > 1e-5f;
        float target[3];
        for (int f = 0; f < 3; ++f)
        {
            const double fo = freq * kMult[f];
            const int hmax = juce::jlimit (1, kMaxH, (int) (0.45 * sr / fo));
            if (changed || hmax != lastH[f])
            {
                float re[kMaxH], im[kMaxH];
                cycleSpectrum (d, p, f, u, re, im);
                buildTable (re, im, hmax, table[f]);
                lastH[f] = hmax;
            }
            target[f] = juce::jlimit (0.0f, 1.0f, d.flavourCurve (p.chip, p.mix, p.model, f, u));
            if (fresh) level[f] = target[f];
        }
        fresh = false;
        lastU = u; lastChip = p.chip; lastModel = p.model; lastMix = p.mix;

        const float atkStep = 1.0f / (float) std::max (1.0, (double) p.attack * sr);
        for (int f = 0; f < 3; ++f)
        {
            const double inc = freq * kMult[f] / sr;
            const float a0 = level[f], da = (target[f] - a0) / (float) n;
            double ph = phase[f];
            float e = env;
            bool rel = releasing;
            for (int i = 0; i < n; ++i)
            {
                if (rel) e = std::max (0.0f, e - relStep);
                else     e = std::min (1.0f, e + atkStep);
                const double x = ph * kTab;
                const int i0 = ((int) x) & (kTab - 1);
                const float fr = (float) (x - std::floor (x));
                const float s = table[f][i0] * (1.0f - fr) + table[f][(i0 + 1) & (kTab - 1)] * fr;
                out[i] += vel * e * (a0 + da * (float) i) * s;
                ph += inc;
                if (ph >= 1.0) ph -= 1.0;
            }
            phase[f] = ph;
            level[f] = target[f];
            if (f == 2) env = e;   // the envelope advances once per sample, shared by all three
        }
        age += (double) n / sr;
        if (releasing && env <= 0.0f)
            active = false;
    }
};

class Engine
{
public:
    void prepare (double sampleRate)
    {
        sr = sampleRate > 0 ? sampleRate : 44100.0;
        for (auto& v : voices) v.active = false;
        scratch.assign ((size_t) kBlock, 0.0f);
    }

    void render (juce::AudioBuffer<float>& buffer, const juce::MidiBuffer& midi, const Params& p, const FlavourData& d)
    {
        int pos = 0;
        const int total = buffer.getNumSamples();
        for (const auto meta : midi)
        {
            const int at = juce::jlimit (0, total, meta.samplePosition);
            renderRange (buffer, pos, at - pos, p, d);
            pos = at;
            handle (meta.getMessage(), p);
        }
        renderRange (buffer, pos, total - pos, p, d);
    }

    double voiceU (const Params& p, const FlavourData& d) const   // newest sounding voice, for the display
    {
        const Voice* best = nullptr;
        for (auto& v : voices)
            if (v.active && (best == nullptr || v.age < best->age)) best = &v;
        return best ? std::min (d.umax, p.u + (double) p.flight * best->age) : p.u;
    }

private:
    void handle (const juce::MidiMessage& m, const Params& p)
    {
        if (m.isNoteOn())
        {
            Voice* v = nullptr;
            for (auto& c : voices) if (! c.active) { v = &c; break; }
            if (v == nullptr)   // steal: prefer a releasing voice, then the oldest
            {
                for (auto& c : voices)
                    if (v == nullptr || (c.releasing && ! v->releasing) || (c.releasing == v->releasing && c.age > v->age))
                        v = &c;
            }
            v->start (m.getNoteNumber(), m.getFloatVelocity());
        }
        else if (m.isNoteOff())
        {
            for (auto& c : voices)
                if (c.active && ! c.releasing && c.note == m.getNoteNumber()) c.stop (p, sr);
        }
        else if (m.isAllNotesOff() || m.isAllSoundOff())
        {
            for (auto& c : voices) if (c.active) c.stop (p, sr);
        }
    }

    void renderRange (juce::AudioBuffer<float>& buffer, int start, int num, const Params& p, const FlavourData& d)
    {
        while (num > 0)
        {
            const int n = std::min (num, kBlock);
            std::fill (scratch.begin(), scratch.begin() + n, 0.0f);
            for (auto& v : voices)
                if (v.active) v.render (scratch.data(), n, p, d, sr);
            const float g = p.gain * 0.3f;
            for (int ch = 0; ch < buffer.getNumChannels(); ++ch)
            {
                float* o = buffer.getWritePointer (ch, start);
                for (int i = 0; i < n; ++i) o[i] += g * scratch[(size_t) i];
            }
            start += n;
            num -= n;
        }
    }

    double sr = 44100.0;
    std::array<Voice, kVoices> voices;
    std::vector<float> scratch = std::vector<float> ((size_t) kBlock, 0.0f);
};
} // namespace flavour
