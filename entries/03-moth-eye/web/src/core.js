// core.js: shared by web/index.html (the interactive viewer) and render/render.html (the offline MP4).
// Everything here is CLASSICAL: mesh generation, the engine's GLSL ported to WebGL2, and a pixel-average meter.
// The only quantum-derived data are the R/T lookup tables (LUTS), downloaded unchanged from real Atlas jobs.
const MothEye = (() => {
  // Same numbers as geometry.py. Units: pillar pitches.
  const GEOM = {facet_R: 12.0, dome_sag: 6.0, pillar_h: 1.0, pillar_r: 0.5, sub: 8};
  const SQ3 = Math.sqrt(3);

  function nearestPillarDist(x, y) {
    const r = y / (SQ3 / 2), q = x - r / 2;
    let cx = q, cz = r, cy = -cx - cz;
    let rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
    const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
    const px = rx + rz / 2, py = rz * SQ3 / 2;
    return Math.hypot(x - px, y - py);
  }
  function pillarHeight(x, y, g = GEOM) {
    const d = nearestPillarDist(x, y);
    return d < g.pillar_r ? g.pillar_h * (1 - (d / g.pillar_r) ** 2) : 0;
  }

  // Top surface of one hexagonal facet on a triangular lattice, plus a short skirt so it reads as a solid.
  // kind: 'eye' (dome + nanopillars), 'dome' (no pillars), 'slab' (flat control). z is up (faces +z).
  function facetArrays(kind, g = GEOM) {
    const n = Math.round(g.facet_R * g.sub), d = 1 / g.sub;
    const A = g.facet_R, H = g.dome_sag, Rc = (A * A + H * H) / (2 * H);
    const idx = new Map(), pos = [];
    let count = 0;
    for (let q = -n; q <= n; q++) {
      for (let r = Math.max(-n, -q - n); r <= Math.min(n, -q + n); r++) {
        const x = d * (q + r / 2), y = d * (r * SQ3 / 2);
        let px = x, py = y, pz = 0;
        if (kind !== 'slab') {
          const zc = Math.sqrt(Math.max(Rc * Rc - x * x - y * y, 0)) - (Rc - H);
          const nx = x / Rc, ny = y / Rc, nz = (zc + Rc - H) / Rc;
          const h = kind === 'eye' ? pillarHeight(x, y, g) : 0;
          px = x + nx * h; py = y + ny * h; pz = zc + nz * h;
        }
        pos.push(px, py, pz);
        idx.set(q * 100000 + r, count++);
      }
    }
    const key = (q, r) => idx.get(q * 100000 + r);
    const tri = [];
    for (let q = -n; q <= n; q++) {
      for (let r = Math.max(-n, -q - n); r <= Math.min(n, -q + n); r++) {
        const i = key(q, r), j = key(q + 1, r), k = key(q, r + 1), j2 = key(q + 1, r - 1);
        if (j !== undefined && k !== undefined) tri.push(i, j, k);
        if (j2 !== undefined && j !== undefined) tri.push(i, j2, j);
      }
    }
    // skirt: walk the hexagon boundary and drop a wall to z = -1.2
    const ring = [];
    const corners = [[n, 0], [0, n], [-n, n], [-n, 0], [0, -n], [n, -n]];
    for (let c = 0; c < 6; c++) {
      const [q0, r0] = corners[c], [q1, r1] = corners[(c + 1) % 6];
      for (let s = 0; s < n; s++) ring.push(key(q0 + (q1 - q0) * s / n, r0 + (r1 - r0) * s / n));
    }
    const base = count;
    for (const i of ring) { pos.push(pos[3 * i], pos[3 * i + 1], -1.2); count++; }
    for (let s = 0; s < ring.length; s++) {
      const a = ring[s], b = ring[(s + 1) % ring.length], a2 = base + s, b2 = base + (s + 1) % ring.length;
      tri.push(a, a2, b2, a, b2, b);
    }
    return {pos: new Float32Array(pos), index: count > 65535 ? new Uint32Array(tri) : new Uint16Array(tri), topCount: base};
  }

  function facetGeometry(THREE, kind) {
    const a = facetArrays(kind);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(a.pos, 3));
    geo.setIndex(new THREE.BufferAttribute(a.index, 1));
    geo.computeVertexNormals();
    return geo;
  }

  function b64floats(b64) {
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Float32Array(u8.buffer);
  }
  function lutTexture(THREE, data, w, h) {
    const tex = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.FloatType);
    tex.minFilter = tex.magFilter = THREE.NearestFilter;   // we do GL_LINEAR by hand with texelFetch
    tex.flipY = false; tex.generateMipmaps = false; tex.needsUpdate = true;
    return tex;
  }

  const VERT = `
    varying vec3 vN; varying vec3 vW;
    void main(){
      vec4 w = modelMatrix * vec4(position, 1.0);
      vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * w;
    }`;

  // The engine's entanglement_texture.glsl, ported line by line (see out/jobs/*/entanglement_texture.glsl),
  // with its GL_LINEAR + REPEAT(s) + CLAMP_TO_EDGE(t) sampler state done by hand.
  const ENGINE_GLSL = `
    uniform sampler2D uR; uniform sampler2D uT; uniform vec2 uSize; uniform float uThickness;
    const float ET_PI_2 = 1.5707963267948966; const float ET_TWO_PI = 6.283185307179586;
    float lutAt(sampler2D tex, float s, float t){
      float x = s * uSize.x - 0.5; float x0 = floor(x); float fx = x - x0;
      int i0 = int(mod(x0, uSize.x)); int i1 = int(mod(x0 + 1.0, uSize.x));
      float y = clamp(t * uSize.y - 0.5, 0.0, uSize.y - 1.0); float y0 = floor(y); float fy = y - y0;
      int j0 = int(y0); int j1 = int(min(y0 + 1.0, uSize.y - 1.0));
      float a = mix(texelFetch(tex, ivec2(i0, j0), 0).r, texelFetch(tex, ivec2(i1, j0), 0).r, fx);
      float b = mix(texelFetch(tex, ivec2(i0, j1), 0).r, texelFetch(tex, ivec2(i1, j1), 0).r, fx);
      return mix(a, b, fy);
    }
    void engineShader(vec3 N, vec3 V, out vec3 R, out vec3 T){
      float cosTheta = abs(dot(normalize(N), normalize(V)));
      float theta = acos(clamp(cosTheta, 0.0, 1.0));
      float D = -2.0 * ET_TWO_PI * uThickness * cosTheta;
      const vec3 wavelength = vec3(650.0, 530.0, 470.0);
      float s0 = mod(D / wavelength.r, ET_TWO_PI) / ET_TWO_PI;
      float s1 = mod(D / wavelength.g, ET_TWO_PI) / ET_TWO_PI;
      float s2 = mod(D / wavelength.b, ET_TWO_PI) / ET_TWO_PI;
      float t = theta / ET_PI_2;
      R = vec3(lutAt(uR, s0, t), lutAt(uR, s1, t), lutAt(uR, s2, t));
      T = vec3(lutAt(uT, s0, t), lutAt(uT, s1, t), lutAt(uT, s2, t));
    }
    uniform vec3 uLight; uniform int uMode;
    // Classical scene lighting (our choice, not the engine's): a dim night sky, a dark ground, and one lamp.
    vec3 sky(vec3 d){
      float u = d.y;
      vec3 c = u > 0.0 ? mix(vec3(0.62, 0.58, 0.72), vec3(0.10, 0.12, 0.24), pow(u, 0.5))
                       : mix(vec3(0.22, 0.17, 0.14), vec3(0.05, 0.04, 0.035), pow(-u, 0.5));
      return c;
    }
    float lampMask(vec3 d){ return smoothstep(0.99813, 0.99905, dot(normalize(d), normalize(uLight))); }   // lamp disc: 2.5-3.5 deg
    const vec3 LUMW = vec3(0.2126, 0.7152, 0.0722);
  `;

  const FRAG_VIEW = ENGINE_GLSL + `
    varying vec3 vN; varying vec3 vW;
    void main(){
      vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
      vec3 R, T; engineShader(N, V, R, T);
      vec3 col;
      if (uMode == 1) { col = R * 0.75; }                       // raw engine reflectance (outReflectance)
      else {
        vec3 rd = reflect(-V, N);
        vec3 lamp = vec3(1.0, 0.86, 0.62) * (lampMask(rd) * 9.0 + 0.6 * pow(max(dot(rd, normalize(uLight)), 0.0), 64.0));
        col = R * (sky(rd) * 1.5 + lamp) + T * vec3(0.20, 0.06, 0.03);
        col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);   // ACES-style tone curve
      }
      gl_FragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
    }`;

  // Meter pass: per pixel, r = luminance of the engine's R at this pixel's angle (what a uniform sky would show),
  // g = the same where the mirror direction hits the lamp (glare toward the viewer). Averaged over covered pixels.
  const FRAG_METER = ENGINE_GLSL + `
    varying vec3 vN; varying vec3 vW; uniform float uScale;
    void main(){
      vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
      vec3 R, T; engineShader(N, V, R, T);
      float l = dot(R, LUMW);
      vec3 rd = reflect(-V, N);
      gl_FragColor = vec4(l * uScale, l * lampMask(rd) * uScale, dot(T, LUMW) * uScale, 1.0);
    }`;

  function material(THREE, frag, extra = {}) {
    return new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: frag,
      uniforms: Object.assign({uR: {value: null}, uT: {value: null}, uSize: {value: new THREE.Vector2(60, 60)},
        uThickness: {value: 500}, uLight: {value: new THREE.Vector3(0.4, 0.5, 0.77)}, uMode: {value: 0}, uScale: {value: 0.5}}, extra),
    });
  }

  // Light direction from a point on the light pad (unit disc): front hemisphere, world space.
  function padToLight(px, py) {
    const r2 = px * px + py * py, k = r2 > 0.98 ? Math.sqrt(0.98 / r2) : 1;
    const x = px * k, y = py * k;
    return [x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y))];
  }
  // Orbit camera: azimuth/elevation in degrees around a target, z-up scene turned so the facet faces the viewer.
  function orbitPosition(az, el, dist) {
    const a = az * Math.PI / 180, e = el * Math.PI / 180;
    return [dist * Math.cos(e) * Math.sin(a), dist * Math.sin(e), dist * Math.cos(e) * Math.cos(a)];
  }

  const tagFor = (L, i) => i === 1 ? `L${L}_R6` : `L${L}_R6_int0`;

  // The 3D viewer used by both the page and the offline film. st = {layers, inter, geo, mode, az, el, dist, lx, ly, th}.
  function Viewer(THREE, canvas, LUTS, opts = {}) {
    let renderer;
    try { renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true}); } catch (e) { return {ok: false}; }
    if (!renderer.capabilities.isWebGL2) return {ok: false};
    renderer.outputEncoding = THREE.LinearEncoding;
    const bg = new THREE.Color(opts.bg || '#FFFFFF');   // paper/panel ground of the page (brand), not part of the shading
    const scene = new THREE.Scene(); scene.background = bg; renderer.setClearColor(bg, 1);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 400);
    const tex = {};
    for (const [tag, L] of Object.entries(LUTS)) tex[tag] = {R: lutTexture(THREE, b64floats(L.R), L.w, L.h), T: lutTexture(THREE, b64floats(L.T), L.w, L.h)};
    const view = material(THREE, FRAG_VIEW), meter = material(THREE, FRAG_METER), meshes = {};
    for (const k of ['eye', 'dome', 'slab']) {
      const g = facetGeometry(THREE, k);
      meshes[k] = new THREE.Mesh(g, view); meshes[k + '_m'] = new THREE.Mesh(g, meter);
      scene.add(meshes[k]);
    }
    const mScene = new THREE.Scene(), mCam = new THREE.PerspectiveCamera(32, 1, 0.5, 400);
    const floatOK = renderer.extensions.has('EXT_color_buffer_float');
    const N = 128, rt = new THREE.WebGLRenderTarget(N, N, {type: floatOK ? THREE.FloatType : THREE.UnsignedByteType});
    const buf = floatOK ? new Float32Array(N * N * 4) : new Uint8Array(N * N * 4);
    meter.uniforms.uScale.value = floatOK ? 1 : 0.5;
    function uniforms(m, st) {
      const t = tex[tagFor(st.layers, st.inter)], L = padToLight(st.lx, st.ly);
      m.uniforms.uR.value = t.R; m.uniforms.uT.value = t.T; m.uniforms.uThickness.value = st.th;
      m.uniforms.uLight.value.set(L[0], L[1], L[2]); m.uniforms.uMode.value = st.mode;
    }
    function place(cam, st, dist, target) {
      const p = orbitPosition(st.az, st.el, dist);
      cam.position.set(target[0] + p[0], target[1] + p[1], target[2] + p[2]); cam.up.set(0, 1, 0); cam.lookAt(target[0], target[1], target[2]);
    }
    return {
      ok: true, renderer, floatOK,
      setSize(w, h, ratio = 1) { renderer.setPixelRatio(ratio); renderer.setSize(w, h, false); camera.aspect = w / h; camera.userData.wh = [w, h]; camera.updateProjectionMatrix(); },
      draw(st, extra = {}) {
        uniforms(view, st);
        const both = st.geo === 'both', gap = extra.gap || 13.2;
        for (const k of ['eye', 'dome', 'slab']) meshes[k].visible = both ? k !== 'dome' : k === st.geo;
        meshes.eye.position.set(both ? -gap : 0, 0, 0); meshes.slab.position.set(both ? gap : 0, 0, 0);
        place(camera, st, both ? st.dist * (extra.bothZoom || 1.6) : st.dist, extra.target || [0, 0, 1.5]);
        const wh = camera.userData.wh || [1, 1];
        if (extra.shiftX) camera.setViewOffset(wh[0], wh[1], extra.shiftX, 0, wh[0], wh[1]); else camera.clearViewOffset();
        renderer.setRenderTarget(null); renderer.render(scene, camera);
      },
      // Off-screen pass per geometry from the same viewing direction; average over covered pixels.
      measure(st) {
        const out = {};
        uniforms(meter, st);
        for (const k of ['eye', 'dome', 'slab']) {
          mScene.children.slice().forEach(c => mScene.remove(c));
          const m = meshes[k + '_m']; m.position.set(0, 0, 0); mScene.add(m);
          place(mCam, st, 40, [0, 0, 1.5]);
          renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();   // off-screen data buffer: alpha 0 marks uncovered pixels
          renderer.render(mScene, mCam);
          renderer.readRenderTargetPixels(rt, 0, 0, N, N, buf);
          renderer.setRenderTarget(null); renderer.setClearColor(bg, 1);
          const sc = floatOK ? 1 : 2 / 255, cut = floatOK ? 0.5 : 127;
          let n = 0, sR = 0, sG = 0, sT = 0;
          for (let i = 0; i < buf.length; i += 4) if (buf[i + 3] > cut) { n++; sR += buf[i] * sc; sG += buf[i + 1] * sc; sT += buf[i + 2] * sc; }
          out[k] = {R: n ? sR / n : 0, glare: n ? sG / n : 0, T: n ? sT / n : 0, px: n};
        }
        return out;
      },
    };
  }

  return {GEOM, pillarHeight, nearestPillarDist, facetArrays, facetGeometry, b64floats, lutTexture,
          material, FRAG_VIEW, FRAG_METER, padToLight, orbitPosition, tagFor, Viewer};
})();
if (typeof module !== 'undefined') module.exports = MothEye;
