"""Syndrome Loom: weave an image through Steane-code error statistics from Atlas tamagotchi-v1.

Quantum step (done once, offline-cached): engine/run_calibration.py runs tamagotchi-v1 on Atlas's
Aer stabilizer simulator and stores the measured rates in loom/data/calibration.json.
Classical steps (this package): binarise, encode as Steane codewords, sample flips from those
measured rates, Hamming-decode, write a WIF 1.1 draft, render a shaded preview, write a report.
"""
__version__ = "0.1.0"
