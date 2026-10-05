#include "PluginEditor.h"

using namespace flavourui;

// ---------------------------------------------------------------- curve view
juce::Rectangle<float> CurveView::plotArea() const
{
    return getLocalBounds().toFloat().reduced (12.0f, 10.0f).withTrimmedLeft (26.0f).withTrimmedBottom (16.0f);
}

void CurveView::paint (juce::Graphics& g)
{
    const auto& d = proc.data;
    const auto p = proc.currentParams();
    const auto& m = d.machines[(size_t) p.chip];
    const auto r = plotArea();
    const juce::Colour col[3] = { warn, ink, good };
    const char* names[3] = { "e swirl", "mu choc-chip", "tau ribbon" };

    g.fillAll (panel);
    g.setColour (rule);
    g.drawRect (r);
    g.setFont (11.0f);
    for (int k = 1; k <= 4; ++k)   // decade grid: 10 .. 10^4 km/GeV
    {
        const double u = (double) k;
        if (u < d.umin || u > d.umax) continue;
        const float x = r.getX() + r.getWidth() * (float) ((u - d.umin) / (d.umax - d.umin));
        g.setColour (rule);
        g.drawVerticalLine ((int) x, r.getY(), r.getBottom());
        g.setColour (ink2);
        g.drawText ("1e" + juce::String (k), juce::Rectangle<float> (x - 20, r.getBottom() + 2, 40, 12), juce::Justification::centred);
    }
    g.setColour (ink2);
    g.drawText ("1", juce::Rectangle<float> (r.getX() - 24, r.getY() - 6, 20, 12), juce::Justification::centredRight);
    g.drawText ("0", juce::Rectangle<float> (r.getX() - 24, r.getBottom() - 6, 20, 12), juce::Justification::centredRight);

    auto value = [&] (const std::vector<float>* P, int f, size_t i) -> float
    {
        if (p.model == 3) return P[f + 1][i];
        if (f == 0) return P[0][i];
        if (f == 1) return 1.0f - P[0][i];
        return 0.0f;
    };

    for (int f = 0; f < 3; ++f)
    {
        if (p.model == 2 && f == 2) continue;
        // exact (classical) curve: thin line, fading with MIX
        juce::Path path;
        const size_t n = d.exact[0].size();
        for (size_t i = 0; i < n; ++i)
        {
            const float x = r.getX() + r.getWidth() * (float) i / (float) (n - 1);
            const float y = r.getBottom() - r.getHeight() * juce::jlimit (0.0f, 1.0f, value (d.exact, f, i));
            if (i == 0) path.startNewSubPath (x, y); else path.lineTo (x, y);
        }
        g.setColour (col[f].withAlpha (0.35f + 0.5f * (1.0f - p.mix)));
        g.strokePath (path, juce::PathStrokeType (1.2f));
        // measured points from the chosen chip
        g.setColour (col[f].withAlpha (0.25f + 0.75f * p.mix));
        const size_t nm = m.P[0].size();
        for (size_t i = 0; i < nm; ++i)
        {
            const float x = r.getX() + r.getWidth() * (float) i / (float) (nm - 1);
            const float y = r.getBottom() - r.getHeight() * juce::jlimit (0.0f, 1.0f, value (m.P, f, i));
            const float rad = nm > 400 ? 1.0f : 2.0f;
            g.fillEllipse (x - rad, y - rad, 2 * rad, 2 * rad);
        }
        g.setColour (col[f]);
        g.drawText (juce::String ("nu_") + names[f], juce::Rectangle<float> (r.getRight() - 120, r.getY() + 4 + 14.0f * f, 114, 12),
                    juce::Justification::centredRight);
    }

    // the knob position (dashed) and the newest voice in flight (solid)
    auto xOf = [&] (double u) { return r.getX() + r.getWidth() * (float) ((u - d.umin) / (d.umax - d.umin)); };
    const float xk = xOf (p.u), xv = xOf (proc.displayU.load());
    g.setColour (ink.withAlpha (0.5f));
    const float dash[] = { 4.0f, 4.0f };
    g.drawDashedLine (juce::Line<float> (xk, r.getY(), xk, r.getBottom()), dash, 2, 1.0f);
    g.setColour (ink);
    g.drawLine (xv, r.getY(), xv, r.getBottom(), 2.0f);
}

void CurveView::setFromX (float x)
{
    const auto r = plotArea();
    const auto& d = proc.data;
    const double t = juce::jlimit (0.0, 1.0, (double) ((x - r.getX()) / r.getWidth()));
    const double le = std::pow (10.0, d.umin + t * (d.umax - d.umin));
    if (auto* prm = proc.apvts.getParameter ("le"))
        prm->setValueNotifyingHost (prm->convertTo0to1 ((float) le));
}

void CurveView::mouseDown (const juce::MouseEvent& e)
{
    if (auto* prm = proc.apvts.getParameter ("le")) prm->beginChangeGesture();
    setFromX ((float) e.position.x);
}

void CurveView::mouseDrag (const juce::MouseEvent& e) { setFromX ((float) e.position.x); }

void CurveView::mouseUp (const juce::MouseEvent&)
{
    if (auto* prm = proc.apvts.getParameter ("le")) prm->endChangeGesture();
}

// ---------------------------------------------------------------- editor
void FlavourEditor::knob (juce::Slider& s, juce::Label& l, const juce::String& name)
{
    s.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
    s.setTextBoxStyle (juce::Slider::TextBoxBelow, false, 84, 18);
    s.setColour (juce::Slider::rotarySliderFillColourId, ink);
    s.setColour (juce::Slider::rotarySliderOutlineColourId, rule);
    s.setColour (juce::Slider::thumbColourId, ink);
    s.setColour (juce::Slider::textBoxTextColourId, ink);
    s.setColour (juce::Slider::textBoxOutlineColourId, juce::Colours::transparentBlack);
    addAndMakeVisible (s);
    l.setText (name, juce::dontSendNotification);
    l.setJustificationType (juce::Justification::centred);
    l.setColour (juce::Label::textColourId, ink2);
    addAndMakeVisible (l);
}

FlavourEditor::FlavourEditor (FlavourProcessor& p)
    : AudioProcessorEditor (&p), proc (p), curve (p),
      keyboard (p.keyboardState, juce::MidiKeyboardComponent::horizontalKeyboard)
{
    addAndMakeVisible (curve);
    knob (le, leL, "JOURNEY L/E");
    knob (mix, mixL, "RECIPE");
    knob (flight, flightL, "CONVEYOR");
    knob (attack, attackL, "SCOOP-IN");
    knob (release, releaseL, "MELT");
    knob (gain, gainL, "VOLUME");

    for (auto& m : proc.data.machines)
        chip.addItem (m.label, chip.getNumItems() + 1);
    model.addItem ("3 flavours", 1);
    model.addItem ("2 flavours", 2);
    for (auto* c : { &chip, &model })
    {
        c->setColour (juce::ComboBox::backgroundColourId, panel2);
        c->setColour (juce::ComboBox::textColourId, ink);
        c->setColour (juce::ComboBox::outlineColourId, rule);
        c->setColour (juce::ComboBox::arrowColourId, ink);
        addAndMakeVisible (*c);
    }
    chipL.setText ("KITCHEN (which machine measured the recipe)", juce::dontSendNotification);
    modelL.setText ("MENU", juce::dontSendNotification);
    for (auto* l : { &chipL, &modelL, &info })
    {
        l->setColour (juce::Label::textColourId, ink2);
        addAndMakeVisible (*l);
    }
    info.setJustificationType (juce::Justification::topLeft);
    info.setFont (juce::Font (juce::FontOptions (12.0f)));
    addAndMakeVisible (keyboard);

    leA = std::make_unique<SA> (proc.apvts, "le", le);
    mixA = std::make_unique<SA> (proc.apvts, "mix", mix);
    flightA = std::make_unique<SA> (proc.apvts, "flight", flight);
    attackA = std::make_unique<SA> (proc.apvts, "attack", attack);
    releaseA = std::make_unique<SA> (proc.apvts, "release", release);
    gainA = std::make_unique<SA> (proc.apvts, "gain", gain);
    chipA = std::make_unique<CA> (proc.apvts, "chip", chip);
    modelA = std::make_unique<CA> (proc.apvts, "model", model);

    setResizable (true, true);
    setResizeLimits (640, 460, 1400, 1000);
    setSize (820, 560);
    startTimerHz (30);
}

FlavourEditor::~FlavourEditor() { stopTimer(); }

void FlavourEditor::paint (juce::Graphics& g)
{
    g.fillAll (paper);
    g.setColour (ink);
    g.fillRect (0, 0, getWidth(), 44);
    g.setColour (paper);
    g.setFont (juce::Font (juce::FontOptions (22.0f)));
    g.drawText ("FLAVOUR", 16, 8, 200, 28, juce::Justification::centredLeft);
    g.setFont (juce::Font (juce::FontOptions (12.0f)));
    g.drawText ("the neutrino gelateria: a muon scoop's flavour curves, written onto qubits and read back with qpixl-v1 "
                "(Moth Atlas). Physics computed classically.",
                170, 8, getWidth() - 186, 28, juce::Justification::centredLeft);
}

void FlavourEditor::resized()
{
    auto r = getLocalBounds().reduced (12);
    r.removeFromTop (40);
    keyboard.setBounds (r.removeFromBottom (64));
    r.removeFromBottom (8);
    auto controls = r.removeFromBottom (128);
    curve.setBounds (r.reduced (0, 4));

    auto side = controls.removeFromRight (250);
    chipL.setBounds (side.removeFromTop (18));
    chip.setBounds (side.removeFromTop (26));
    side.removeFromTop (4);
    modelL.setBounds (side.removeFromTop (18));
    model.setBounds (side.removeFromTop (26));
    info.setBounds (side.reduced (0, 2));

    juce::Slider* ks[] = { &le, &mix, &flight, &attack, &release, &gain };
    juce::Label* ls[] = { &leL, &mixL, &flightL, &attackL, &releaseL, &gainL };
    const int w = controls.getWidth() / 6;
    for (int i = 0; i < 6; ++i)
    {
        auto c = controls.removeFromLeft (w);
        ls[i]->setBounds (c.removeFromTop (18));
        ks[i]->setBounds (c.reduced (4, 0));
    }
}

void FlavourEditor::timerCallback()
{
    const auto p = proc.currentParams();
    const auto& m = proc.data.machines[(size_t) p.chip];
    info.setText (m.kindLabel + "\n" + juce::String (m.values) + " values, " + juce::String (m.n) + " pts/curve, "
                      + juce::String (m.shots) + " shots\njob " + m.jobId.substring (0, 8),
                  juce::dontSendNotification);
    curve.repaint();
}
