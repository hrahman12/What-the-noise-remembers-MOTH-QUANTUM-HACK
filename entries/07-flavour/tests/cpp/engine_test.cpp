// Test harness for the plugin's engine headers (plugin/Source/FlavourData.h + FlavourEngine.h).
// Compiled against the tiny JUCE shim in tests/cpp/shim (not the JUCE runtime), so it checks the
// engine's maths and voice logic, not the plugin wrapper or the GUI.
//
//   engine_test <flavour_curves.json> <py_cases.json> <out_sweep.f32>
//
// 1. For every case in py_cases.json (from tests/make_cases.py) it rebuilds the wavetable and level with
//    the C++ code and reports the largest difference from the Python replica.
// 2. It renders the "sweep" demo scenario (A3 held, L/E 20 -> 50,000 km/GeV over 24 s, chip 0, mix 1)
//    in 256-sample host blocks and writes raw float32 mono samples for tests/compare_cpp.py.
#include "../../plugin/Source/FlavourEngine.h"
#include <cstdio>
#include <fstream>
#include <sstream>

static std::string slurp (const char* path)
{
    std::ifstream f (path, std::ios::binary);
    std::stringstream ss;
    ss << f.rdbuf();
    return ss.str();
}

int main (int argc, char** argv)
{
    if (argc < 4) { std::printf ("usage: engine_test bundle.json cases.json out.f32\n"); return 2; }
    const std::string bundle = slurp (argv[1]);
    FlavourData d;
    if (! d.loadFromJson (bundle.data(), (int) bundle.size())) { std::printf ("bundle failed to load\n"); return 1; }
    std::printf ("machines %d, exact points %d\n", (int) d.machines.size(), (int) d.exact[0].size());

    // 1. parity with the Python replica
    const std::string casesText = slurp (argv[2]);
    auto cases = juce::JSON::parse (juce::String (casesText));
    double maxLevel = 0, maxTab = 0;
    int n = 0;
    for (auto& c : *cases.getArray())
    {
        flavour::Params p;
        p.chip = (int) c["chip"];
        p.mix = (float) (double) c["mix"];
        p.model = (int) c["model"];
        const int f = (int) c["f"];
        const double u = (double) c["u"];
        float re[flavour::kMaxH], im[flavour::kMaxH], table[flavour::kTab];
        flavour::cycleSpectrum (d, p, f, u, re, im);
        flavour::buildTable (re, im, flavour::kMaxH, table);
        const float lv = juce::jlimit (0.0f, 1.0f, d.flavourCurve (p.chip, p.mix, p.model, f, u));
        maxLevel = std::max (maxLevel, std::abs ((double) lv - (double) c["level"]));
        auto* tab = c["tab"].getArray();
        for (size_t k = 0; k < tab->size(); ++k)
            maxTab = std::max (maxTab, std::abs ((double) table[k * 8] - (double) (*tab)[k]));
        ++n;
    }
    std::printf ("parity: %d cases, max level diff %.3g, max wavetable diff %.3g\n", n, maxLevel, maxTab);

    // 2. render the sweep scenario
    const double sr = 44100.0;
    const int block = 256, total = (int) (26.0 * sr);
    flavour::Engine eng;
    eng.prepare (sr);
    std::vector<float> out;
    out.reserve ((size_t) total);
    const double u0 = std::log10 (20.0), u1 = std::log10 (50000.0);
    for (int pos = 0; pos < total; pos += block)
    {
        const int len = std::min (block, total - pos);
        juce::AudioBuffer<float> buf (1, len);
        juce::MidiBuffer midi;
        if (pos == 0) midi.add (juce::MidiMessage (juce::MidiMessage::On, 57, 0.8f), 0);
        const int offAt = (int) (24.0 * sr);
        if (offAt >= pos && offAt < pos + len) midi.add (juce::MidiMessage (juce::MidiMessage::Off, 57, 0.0f), offAt - pos);
        flavour::Params p;
        const double t = pos / sr;
        p.u = u0 + (u1 - u0) * std::min (1.0, t / 24.0);
        p.chip = 0; p.mix = 1.0f; p.model = 3; p.flight = 0.0f;
        p.attack = 0.4f; p.release = 1.5f; p.gain = 0.8f;
        eng.render (buf, midi, p, d);
        const float* o = buf.getWritePointer (0);
        out.insert (out.end(), o, o + len);
    }
    double peak = 0, sum = 0;
    bool finite = true;
    for (float s : out) { peak = std::max (peak, (double) std::abs (s)); sum += (double) s * s; finite = finite && std::isfinite (s); }
    std::printf ("render: %d samples, peak %.4f, rms %.4f, finite %s\n", (int) out.size(), peak, std::sqrt (sum / out.size()),
                 finite ? "yes" : "NO");
    std::ofstream f (argv[3], std::ios::binary);
    f.write (reinterpret_cast<const char*> (out.data()), (std::streamsize) (out.size() * sizeof (float)));
    return (finite && maxLevel < 1e-5 && maxTab < 1e-3) ? 0 : 1;
}
