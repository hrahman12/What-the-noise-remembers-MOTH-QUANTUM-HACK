// FLAVOUR: the measured neutrino flavour curves, loaded from BinaryData (Resources/flavour_curves.json).
// The JSON is written by bundle.py from cached Moth Atlas qpixl-v1 jobs. Nothing here is computed on a
// quantum device at run time: the plugin replays measured numbers.
#pragma once

#include <juce_core/juce_core.h>
#include <algorithm>
#include <cmath>
#include <vector>

struct FlavourMachine
{
    juce::String id, label, kind, kindLabel, backend, jobId;
    int n = 0, values = 0, shots = 0;
    std::vector<float> P[4];   // P2(mu->e), P3(mu->e), P3(mu->mu), P3(mu->tau), n points each
};

struct FlavourData
{
    double leMin = 20.0, leMax = 50000.0, umin = std::log10 (20.0), umax = std::log10 (50000.0);
    std::vector<float> exact[4];   // classical curves, 1024 points on the same log L/E axis
    std::vector<FlavourMachine> machines;
    juce::String source;

    static std::vector<float> toFloats (const juce::var& arr)
    {
        std::vector<float> out;
        if (auto* a = arr.getArray())
        {
            out.reserve ((size_t) a->size());
            for (auto& v : *a)
                out.push_back ((float) (double) v);
        }
        return out;
    }

    bool loadFromJson (const char* text, int size)
    {
        auto root = juce::JSON::parse (juce::String::fromUTF8 (text, size));
        if (! root.isObject())
            return false;

        leMin = (double) root["le_min"];
        leMax = (double) root["le_max"];
        umin = std::log10 (leMin);
        umax = std::log10 (leMax);
        source = root["source"].toString();

        if (auto* ex = root["exact"]["P"].getArray())
            for (int c = 0; c < 4 && c < ex->size(); ++c)
                exact[c] = toFloats ((*ex)[c]);

        if (auto* ms = root["machines"].getArray())
        {
            for (auto& m : *ms)
            {
                FlavourMachine fm;
                fm.id = m["id"].toString();
                fm.label = m["label"].toString();
                fm.kind = m["kind"].toString();
                fm.kindLabel = m["kind_label"].toString();
                fm.backend = m["backend"].toString();
                fm.jobId = m["job_id"].toString();
                fm.n = (int) m["n"];
                fm.values = (int) m["values"];
                fm.shots = (int) m["shots"];
                if (auto* p = m["P"].getArray())
                    for (int c = 0; c < 4 && c < p->size(); ++c)
                        fm.P[c] = toFloats ((*p)[c]);
                if (fm.P[0].size() >= 2)
                    machines.push_back (fm);
            }
        }

        if (machines.empty())   // never leave the chip list empty: fall back to the exact curves
        {
            FlavourMachine fm;
            fm.id = fm.label = "exact";
            fm.kind = "classical";
            fm.kindLabel = "classical (no measured data found)";
            for (int c = 0; c < 4; ++c)
                fm.P[c] = exact[c];
            fm.n = (int) exact[0].size();
            machines.push_back (fm);
        }
        return exact[0].size() >= 2;
    }

    // linear interpolation of a curve sampled uniformly in log10(L/E); x01 in [0, 1]
    static float interp (const std::vector<float>& c, double x01)
    {
        const int n = (int) c.size();
        if (n < 2)
            return 0.0f;
        const double x = juce::jlimit (0.0, 1.0, x01) * (double) (n - 1);
        const int i = std::min ((int) std::floor (x), n - 2);
        const double t = x - (double) i;
        return (float) ((double) c[(size_t) i] * (1.0 - t) + (double) c[(size_t) i + 1] * t);
    }

    double toX01 (double u) const { return (juce::jlimit (umin, umax, u) - umin) / (umax - umin); }

    // (1 - mix) * exact + mix * measured, for curve index ci at u = log10(L/E)
    float mixed (int chip, float mix, int ci, double u) const
    {
        const auto& m = machines[(size_t) juce::jlimit (0, (int) machines.size() - 1, chip)];
        const double x = toX01 (u);
        return (1.0f - mix) * interp (exact[ci], x) + mix * interp (m.P[ci], x);
    }

    // flavour 0 = e, 1 = mu, 2 = tau. model 3: three-flavour curves; model 2: two-flavour P2(mu->e)
    float flavourCurve (int chip, float mix, int model, int flav, double u) const
    {
        if (model == 3)
            return mixed (chip, mix, flav + 1, u);
        if (flav == 0)
            return mixed (chip, mix, 0, u);
        if (flav == 1)
            return 1.0f - mixed (chip, mix, 0, u);
        return 0.0f;
    }
};
