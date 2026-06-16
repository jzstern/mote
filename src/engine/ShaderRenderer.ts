import type { Particle } from './Particle';
import type { Theme } from '../themes/types';
import type { MoteRenderer } from './MoteRenderer';

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform vec2 uRes;
uniform float uTime;
uniform int uCount;
uniform vec3 uPos[64];
uniform vec3 uCol[64];
uniform vec3 uBg;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1, 0)), c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 px = vUv * uRes;
  vec2 w = vec2(noise(px * 0.006 + uTime * 0.05), noise(px * 0.006 - uTime * 0.04));
  px += (w - 0.5) * 46.0;

  float field = 0.0;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 64; i++) {
    if (i >= uCount) break;
    vec2 d = px - uPos[i].xy;
    float r = uPos[i].z;
    float c = (r * r) / (dot(d, d) + 1.0);
    field += c;
    col += uCol[i] * c;
  }
  col = field > 0.0 ? col / field : uBg;

  float body = smoothstep(0.45, 1.25, field);
  float halo = smoothstep(0.12, 0.5, field) * 0.35;
  vec3 outc = mix(uBg, col, body) + col * halo * (1.0 - body);

  float rim = smoothstep(1.3, 0.95, field) * smoothstep(0.55, 0.95, field);
  outc += rim * 0.18 * vec3(
    0.5 + 0.5 * sin(field * 3.0 + uTime),
    0.5 + 0.5 * sin(field * 3.0 + 2.1 + uTime),
    0.5 + 0.5 * sin(field * 3.0 + 4.2 + uTime)
  );
  frag = vec4(outc, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('shader alloc failed');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`shader compile: ${log}`);
  }
  return sh;
}

export class ShaderRenderer implements MoteRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private uRes: WebGLUniformLocation | null;
  private uTime: WebGLUniformLocation | null;
  private uCount: WebGLUniformLocation | null;
  private uPos: WebGLUniformLocation | null;
  private uCol: WebGLUniformLocation | null;
  private uBg: WebGLUniformLocation | null;
  private readonly maxMotes: number;
  private posBuf: Float32Array;
  private colBuf: Float32Array;

  constructor(
    private canvas: HTMLCanvasElement,
    private theme: Theme,
    private reducedMotion = false,
  ) {
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    this.maxMotes = theme.render.shader?.maxMotes ?? 64;
    this.posBuf = new Float32Array(64 * 3);
    this.colBuf = new Float32Array(64 * 3);

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!program) throw new Error('program alloc failed');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`program link: ${gl.getProgramInfoLog(program)}`);
    }
    this.program = program;
    gl.useProgram(program);

    const quad = new Float32Array([-1, -1, 3, -1, -1, 3]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    this.uRes = gl.getUniformLocation(program, 'uRes');
    this.uTime = gl.getUniformLocation(program, 'uTime');
    this.uCount = gl.getUniformLocation(program, 'uCount');
    this.uPos = gl.getUniformLocation(program, 'uPos');
    this.uCol = gl.getUniformLocation(program, 'uCol');
    this.uBg = gl.getUniformLocation(program, 'uBg');
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
  }

  resize(w: number, h: number, dpr: number): void {
    const scale = Math.min(dpr || 1, 1); // metaball field is smooth; cap internal res for cost
    this.canvas.width = Math.max(1, Math.round(w * scale));
    this.canvas.height = Math.max(1, Math.round(h * scale));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  addRing(): void {
    /* shader field has no ring overlay */
  }

  draw(particles: Particle[], w: number, h: number): void {
    const gl = this.gl;
    const [br, bg, bb] = this.theme.render.background;

    const chosen =
      particles.length <= this.maxMotes
        ? particles
        : [...particles].sort((a, b) => b.size - a.size).slice(0, this.maxMotes);
    const n = Math.min(chosen.length, 64);
    for (let i = 0; i < n; i++) {
      const p = chosen[i];
      const [r, g, b] = this.theme.render.palette[p.voice];
      this.posBuf[i * 3] = p.pos.x;
      this.posBuf[i * 3 + 1] = p.pos.y;
      this.posBuf[i * 3 + 2] = p.size;
      this.colBuf[i * 3] = r / 255;
      this.colBuf[i * 3 + 1] = g / 255;
      this.colBuf[i * 3 + 2] = b / 255;
    }

    gl.useProgram(this.program);
    gl.uniform2f(this.uRes, w, h);
    gl.uniform1f(this.uTime, this.reducedMotion ? 0 : performance.now() / 1000);
    gl.uniform1i(this.uCount, n);
    gl.uniform3fv(this.uPos, this.posBuf);
    gl.uniform3fv(this.uCol, this.colBuf);
    gl.uniform3f(this.uBg, br / 255, bg / 255, bb / 255);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
