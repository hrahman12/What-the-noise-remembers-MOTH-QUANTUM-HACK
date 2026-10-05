from loom.prng import Mulberry32

# reference values produced by the JavaScript twin in web/template.html (node)
JS_SEED_1 = [0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741, 0.9683778982143849]
JS_SEED_MAX = [0.8964226141106337, 0.189478256739676, 0.7156526781618595]


def test_matches_javascript():
    r = Mulberry32(1)
    assert [r.random() for _ in range(5)] == JS_SEED_1
    q = Mulberry32(4294967295)
    assert [q.random() for _ in range(3)] == JS_SEED_MAX


def test_range():
    r = Mulberry32(99)
    xs = [r.random() for _ in range(5000)]
    assert min(xs) >= 0 and max(xs) < 1
    assert 0.45 < sum(xs) / len(xs) < 0.55
