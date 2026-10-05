#!/usr/bin/env bash
# The C++ checks that were possible on the build machine, which has no desktop C++ toolchain.
# The only compiler there was the Android NDK's clang, so:
#   1. type-check the plugin sources against real JUCE 8.0.8 headers (clang -fsyntax-only, Android target);
#   2. compile the engine headers + tests/cpp/engine_test.cpp against the tiny JUCE shim in tests/cpp/shim
#      as a static executable, run it under WSL (Linux), and compare its audio with synth.py.
# Neither step builds or loads the actual plugin. That is the CI workflow's job.
#
# usage (Git Bash):  JUCE=/path/to/JUCE-8.0.8 NDK=/path/to/ndk/<ver> bash tests/cpp/run_checks.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
CLANG="$NDK/toolchains/llvm/prebuilt/windows-x86_64/bin/clang++.exe"
STUB=$(mktemp -d)
printf 'namespace BinaryData {\n extern const char* flavour_curves_json;\n const int flavour_curves_jsonSize = 1;\n}\n' > "$STUB/BinaryData.h"

for f in PluginProcessor.cpp PluginEditor.cpp; do
  echo "== type-check $f against JUCE headers"
  "$CLANG" --target=x86_64-linux-android24 -std=c++17 -fsyntax-only -Wall -Wextra \
    -DJUCE_GLOBAL_MODULE_SETTINGS_INCLUDED=1 -DJUCE_WEB_BROWSER=0 -DJUCE_USE_CURL=0 \
    -I"$JUCE/modules" -I"$STUB" "plugin/Source/$f"
done

echo "== engine test (static binary, run under WSL)"
"$CLANG" --target=x86_64-linux-android24 -static -O2 -std=c++17 -Itests/cpp/shim tests/cpp/engine_test.cpp -o tests/cpp/engine_test
python tests/make_cases.py
wsl.exe -d Ubuntu -- ./tests/cpp/engine_test plugin/Resources/flavour_curves.json tests/py_cases.json out/cpp_sweep.f32
python tests/compare_cpp.py
