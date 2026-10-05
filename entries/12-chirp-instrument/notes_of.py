"""Parse a MIDI file into a flat note list [(start_s, dur_s, pitch, velocity, track_index)]. CLASSICAL."""
import mido


def notes_of(path):
    mid = mido.MidiFile(path)
    tempo, tpb = 500000, mid.ticks_per_beat
    # tempo map from all tracks (type 1: conductor track)
    tmap = []
    for tr in mid.tracks:
        now = 0
        for m in tr:
            now += m.time
            if m.type == "set_tempo":
                tmap.append((now, m.tempo))
    tmap.sort()

    def secs(tick):
        s, last, tp = 0.0, 0, 500000
        for tk, t in tmap:
            if tk >= tick:
                break
            s += (tk - last) * tp / 1e6 / tpb
            last, tp = tk, t
        return s + (tick - last) * tp / 1e6 / tpb

    out = []
    for ti, tr in enumerate(mid.tracks):
        now, on = 0, {}
        for m in tr:
            now += m.time
            if m.type == "note_on" and m.velocity > 0:
                on.setdefault((m.channel, m.note), []).append((now, m.velocity))
            elif m.type in ("note_off", "note_on"):
                st = on.get((m.channel, m.note))
                if st:
                    a, v = st.pop(0)
                    out.append((secs(a), secs(now) - secs(a), m.note, v, ti))
    out.sort()
    return out
