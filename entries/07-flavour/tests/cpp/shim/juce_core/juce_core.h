// TEST SHIM ONLY: the few juce_core pieces FlavourData.h / FlavourEngine.h use, so the plugin's
// engine headers can be compiled and run in a test harness without the JUCE runtime.
// The real plugin builds against JUCE 8 (see plugin/CMakeLists.txt).
#pragma once
#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <map>
#include <memory>
#include <string>
#include <vector>

namespace juce
{
template <typename T> T jlimit (T lo, T hi, T v) { return v < lo ? lo : (hi < v ? hi : v); }

class String
{
public:
    String() = default;
    String (const char* c) : s (c ? c : "") {}
    String (const std::string& x) : s (x) {}
    static String fromUTF8 (const char* t, int n) { return String (std::string (t, (size_t) n)); }
    String operator+ (const String& o) const { return String (s + o.s); }
    friend String operator+ (const char* a, const String& b) { return String (std::string (a) + b.s); }
    std::string s;
};

class var
{
public:
    enum Kind { Void, Num, Str, Arr, Obj } kind = Void;
    double n = 0;
    std::string str;
    std::shared_ptr<std::vector<var>> arr;
    std::shared_ptr<std::map<std::string, var>> obj;

    bool isObject() const { return kind == Obj; }
    const var& operator[] (const char* k) const
    {
        static const var none;
        if (kind != Obj) return none;
        auto it = obj->find (k);
        return it == obj->end() ? none : it->second;
    }
    std::vector<var>* getArray() const { return kind == Arr ? arr.get() : nullptr; }
    operator double() const { return n; }
    operator int() const { return (int) n; }
    String toString() const { return kind == Str ? String (str) : String (std::to_string (n)); }
};

struct JSON
{
    static var parse (const String& text)
    {
        const char* p = text.s.c_str();
        return value (p);
    }

private:
    static void ws (const char*& p) { while (*p && std::isspace ((unsigned char) *p)) ++p; }
    static var value (const char*& p)
    {
        ws (p);
        var v;
        if (*p == '{')
        {
            ++p; v.kind = var::Obj; v.obj = std::make_shared<std::map<std::string, var>>();
            ws (p);
            if (*p == '}') { ++p; return v; }
            for (;;)
            {
                ws (p);
                var k = value (p);
                ws (p); if (*p == ':') ++p;
                (*v.obj)[k.str] = value (p);
                ws (p);
                if (*p == ',') { ++p; continue; }
                if (*p == '}') { ++p; break; }
                break;
            }
        }
        else if (*p == '[')
        {
            ++p; v.kind = var::Arr; v.arr = std::make_shared<std::vector<var>>();
            ws (p);
            if (*p == ']') { ++p; return v; }
            for (;;)
            {
                v.arr->push_back (value (p));
                ws (p);
                if (*p == ',') { ++p; continue; }
                if (*p == ']') { ++p; break; }
                break;
            }
        }
        else if (*p == '"')
        {
            ++p; v.kind = var::Str;
            while (*p && *p != '"')
            {
                if (*p == '\\' && p[1]) { ++p; v.str += (*p == 'n' ? '\n' : *p); ++p; }
                else v.str += *p++;
            }
            if (*p == '"') ++p;
        }
        else if (std::strncmp (p, "true", 4) == 0) { p += 4; v.kind = var::Num; v.n = 1; }
        else if (std::strncmp (p, "false", 5) == 0) { p += 5; v.kind = var::Num; v.n = 0; }
        else if (std::strncmp (p, "null", 4) == 0) { p += 4; }
        else
        {
            char* end = nullptr;
            v.n = std::strtod (p, &end);
            v.kind = var::Num;
            p = end;
        }
        return v;
    }
};
} // namespace juce
