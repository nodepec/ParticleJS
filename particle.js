(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.ParticleJS = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MathUtils = {
    lerp: (a, b, t) => a + (b - a) * t,
    clamp: (v, min, max) => Math.min(Math.max(v, min), max),
    rand: (min, max) => min + Math.random() * (max - min),
    randInt: (min, max) => Math.floor(MathUtils.rand(min, max + 1)),
    randItem: (arr) => arr[Math.floor(Math.random() * arr.length)],
    deg2rad: (d) => d * Math.PI / 180,
    rad2deg: (r) => r * 180 / Math.PI,
    dist: (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
    noise: (() => {
      const p = new Uint8Array(512);
      const perm = new Uint8Array(256);
      for (let i = 0; i < 256; i++) perm[i] = i;
      for (let i = 255; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]];
      }
      for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
      const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
      const grad = (hash, x, y) => {
        const h = hash & 3;
        const u = h < 2 ? x : y;
        const v = h < 2 ? y : x;
        return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
      };
      return (x, y) => {
        const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
        x -= Math.floor(x); y -= Math.floor(y);
        const u = fade(x), v = fade(y);
        const a = p[X] + Y, b = p[X + 1] + Y;
        return MathUtils.lerp(
          MathUtils.lerp(grad(p[a], x, y), grad(p[b], x - 1, y), u),
          MathUtils.lerp(grad(p[a + 1], x, y - 1), grad(p[b + 1], x - 1, y - 1), u),
          v
        );
      };
    })()
  };
  const Color = {
    parse: (color) => {
      if (Array.isArray(color)) return { r: color[0], g: color[1], b: color[2], a: color[3] ?? 1 };
      if (typeof color === 'object' && 'r' in color) return color;
      const el = document.createElement('div');
      el.style.color = color;
      document.body.appendChild(el);
      const computed = getComputedStyle(el).color;
      document.body.removeChild(el);
      const m = computed.match(/[\d.]+/g);
      return m ? { r: +m[0], g: +m[1], b: +m[2], a: m[3] !== undefined ? +m[3] : 1 } : { r: 255, g: 255, b: 255, a: 1 };
    },
    lerp: (a, b, t) => ({
      r: MathUtils.lerp(a.r, b.r, t),
      g: MathUtils.lerp(a.g, b.g, t),
      b: MathUtils.lerp(a.b, b.b, t),
      a: MathUtils.lerp(a.a, b.a, t),
    }),
    toRgba: (c, alphaOverride) => {
      const a = alphaOverride !== undefined ? alphaOverride : c.a;
      return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${a.toFixed(3)})`;
    },
    toHex: (c) => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join(''),
    hsl2rgb: (h, s, l) => {
      h /= 360; s /= 100; l /= 100;
      let r, g, b;
      if (s === 0) { r = g = b = l; }
      else {
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1 / 6) return p + (q - p) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
      }
      return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a: 1 };
    }
  };
  class Particle {
    constructor(config) {
      this.reset(config);
    }
    reset(config) {
      this.x = config.x ?? 0;
      this.y = config.y ?? 0;
      this.vx = config.vx ?? 0;
      this.vy = config.vy ?? 0;
      this.ax = 0;
      this.ay = 0;
      this.life = config.life ?? 1;
      this.maxLife = this.life;
      this.alive = true;
      this.size = config.size ?? 4;
      this.startSize = this.size;
      this.endSize = config.endSize ?? 0;
      this.rotation = config.rotation ?? 0;
      this.rotationSpeed = config.rotationSpeed ?? 0;
      this.mass = config.mass ?? 1;
      this.drag = config.drag ?? 0.99;
      this.bounce = config.bounce ?? 0;
      this.colorStops = config.colorStops ?? [{ r: 255, g: 255, b: 255, a: 1 }];
      this.shape = config.shape ?? 'circle';
      this.customDraw = config.customDraw ?? null;
      this.blendMode = config.blendMode ?? 'source-over';
      this.glowSize = config.glowSize ?? 0;
      this.glowColor = config.glowColor ?? null;
      this.trail = config.trail ?? false;
      this.trailLength = config.trailLength ?? 10;
      this.trailPositions = [];
      this.turbulence = config.turbulence ?? 0;
      this.turbulenceScale = config.turbulenceScale ?? 0.005;
      this.noiseOffset = Math.random() * 1000;
      this.image = config.image ?? null;
      this.imageRotate = config.imageRotate ?? false;
      this.data = config.data ?? {};
      this._id = Math.random();
    }
    get progress() { return 1 - (this.life / this.maxLife); }
    get currentColor() {
      if (this.colorStops.length === 1) return this.colorStops[0];
      const t = this.progress;
      const segment = t * (this.colorStops.length - 1);
      const idx = Math.floor(segment);
      const localT = segment - idx;
      const a = this.colorStops[Math.min(idx, this.colorStops.length - 1)];
      const b = this.colorStops[Math.min(idx + 1, this.colorStops.length - 1)];
      return Color.lerp(a, b, localT);
    }
    get currentSize() {
      return MathUtils.lerp(this.startSize, this.endSize, this.progress);
    }
    update(dt, forces, system) {
      if (!this.alive) return;
      this.life -= dt;
      if (this.life <= 0) { this.alive = false; return; }
      this.ax = 0; this.ay = 0;
      for (const force of forces) {
        force.apply(this, system);
      }
      if (this.turbulence > 0) {
        const t = system.time * 0.001;
        const nx = MathUtils.noise((this.x * this.turbulenceScale) + this.noiseOffset, t);
        const ny = MathUtils.noise((this.y * this.turbulenceScale) + this.noiseOffset + 100, t);
        this.ax += nx * this.turbulence;
        this.ay += ny * this.turbulence;
      }
      this.vx = (this.vx + this.ax * dt) * Math.pow(this.drag, dt * 60);
      this.vy = (this.vy + this.ay * dt) * Math.pow(this.drag, dt * 60);
      this.x += this.vx * dt * 60;
      this.y += this.vy * dt * 60;
      this.rotation += this.rotationSpeed * dt;
      if (this.trail) {
        this.trailPositions.unshift({ x: this.x, y: this.y });
        if (this.trailPositions.length > this.trailLength) this.trailPositions.pop();
      }
    }
    draw(ctx) {
      if (!this.alive) return;
      const color = this.currentColor;
      const size = this.currentSize;
      if (size <= 0) return;
      ctx.save();
      ctx.globalCompositeOperation = this.blendMode;
      if (this.trail && this.trailPositions.length > 1) {
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        for (let i = 0; i < this.trailPositions.length; i++) {
          const tp = this.trailPositions[i];
          const ta = (1 - i / this.trailPositions.length) * color.a * 0.5;
          ctx.lineTo(tp.x, tp.y);
        }
        ctx.strokeStyle = Color.toRgba(color, color.a * 0.3);
        ctx.lineWidth = size * 0.5;
        ctx.stroke();
      }
      if (this.glowSize > 0) {
        ctx.shadowBlur = this.glowSize;
        ctx.shadowColor = this.glowColor ? Color.toRgba(this.glowColor) : Color.toRgba(color);
      }
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.fillStyle = Color.toRgba(color);
      ctx.strokeStyle = Color.toRgba(color);
      if (this.image) {
        ctx.drawImage(this.image, -size / 2, -size / 2, size, size);
      } else if (this.customDraw) {
        this.customDraw(ctx, this, size, color);
      } else {
        this._drawShape(ctx, size);
      }
      ctx.restore();
    }
    _drawShape(ctx, size) {
      const r = size / 2;
      ctx.beginPath();
      switch (this.shape) {
        case 'circle':
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'square':
          ctx.fillRect(-r, -r, size, size);
          break;
        case 'triangle': {
          const h = size * 0.866;
          ctx.moveTo(0, -h * 0.667);
          ctx.lineTo(r, h * 0.333);
          ctx.lineTo(-r, h * 0.333);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'star': {
          const spikes = 5, outerR = r, innerR = r * 0.45;
          let rot = -Math.PI / 2;
          const step = Math.PI / spikes;
          ctx.moveTo(Math.cos(rot) * outerR, Math.sin(rot) * outerR);
          for (let i = 0; i < spikes; i++) {
            rot += step;
            ctx.lineTo(Math.cos(rot) * innerR, Math.sin(rot) * innerR);
            rot += step;
            ctx.lineTo(Math.cos(rot) * outerR, Math.sin(rot) * outerR);
          }
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'ring':
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.lineWidth = size * 0.15;
          ctx.stroke();
          break;
        case 'spark': {
          ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
          ctx.moveTo(0, -r); ctx.lineTo(0, r);
          ctx.moveTo(-r * 0.7, -r * 0.7); ctx.lineTo(r * 0.7, r * 0.7);
          ctx.moveTo(r * 0.7, -r * 0.7); ctx.lineTo(-r * 0.7, r * 0.7);
          ctx.lineWidth = size * 0.1;
          ctx.stroke();
          break;
        }
        default:
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
      }
    }
  }
  class Force {
    apply(particle, system) { }
    clone() { return Object.assign(Object.create(Object.getPrototypeOf(this)), this); }
  }
  class GravityForce extends Force {
    constructor(gx = 0, gy = 9.8) { super(); this.gx = gx; this.gy = gy; }
    apply(p) { p.ax += this.gx / p.mass; p.ay += this.gy / p.mass; }
  }
  class WindForce extends Force {
    constructor(strength = 1, angle = 0) {
      super();
      this.strength = strength;
      this.angle = angle; 
    }
    apply(p) {
      p.ax += Math.cos(this.angle) * this.strength / p.mass;
      p.ay += Math.sin(this.angle) * this.strength / p.mass;
    }
  }
  class AttractorForce extends Force {
    constructor(x, y, strength = 100, radius = 200, falloff = 'linear') {
      super();
      this.x = x; this.y = y;
      this.strength = strength;
      this.radius = radius;
      this.falloff = falloff; 
    }
    apply(p) {
      const dx = this.x - p.x, dy = this.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d === 0 || d > this.radius) return;
      let factor = this.strength / p.mass;
      if (this.falloff === 'linear') factor *= (1 - d / this.radius);
      else if (this.falloff === 'quadratic') factor *= Math.pow(1 - d / this.radius, 2);
      p.ax += (dx / d) * factor;
      p.ay += (dy / d) * factor;
    }
  }
  class RepellerForce extends AttractorForce {
    apply(p) {
      const dx = this.x - p.x, dy = this.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d === 0 || d > this.radius) return;
      let factor = this.strength / p.mass;
      if (this.falloff === 'linear') factor *= (1 - d / this.radius);
      else if (this.falloff === 'quadratic') factor *= Math.pow(1 - d / this.radius, 2);
      p.ax -= (dx / d) * factor;
      p.ay -= (dy / d) * factor;
    }
  }
  class VortexForce extends Force {
    constructor(x, y, strength = 50, radius = 200) {
      super();
      this.x = x; this.y = y;
      this.strength = strength;
      this.radius = radius;
    }
    apply(p) {
      const dx = this.x - p.x, dy = this.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d === 0 || d > this.radius) return;
      const factor = this.strength * (1 - d / this.radius) / p.mass;
      p.ax += (-dy / d) * factor;
      p.ay += (dx / d) * factor;
    }
  }
  class BuoyancyForce extends Force {
    constructor(density = 0.5, gy = 9.8) { super(); this.density = density; this.gy = gy; }
    apply(p) { p.ay -= this.gy * this.density; }
  }
  class Emitter {
    constructor(config = {}) {
      this.x = config.x ?? 0;
      this.y = config.y ?? 0;
      this.active = config.active ?? true;
      this.rate = config.rate ?? 30;         
      this.burst = config.burst ?? 0;        
      this.duration = config.duration ?? Infinity;
      this.elapsed = 0;
      this._accumulator = 0;
      this._bursted = false;
      this.template = config.template ?? {};
      this.randomizers = config.randomizers ?? {};
      this.spread = config.spread ?? 0;
    }
    _spawnPosition() {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * this.spread;
      return { x: this.x + Math.cos(angle) * r, y: this.y + Math.sin(angle) * r };
    }
    _buildParticleConfig() {
      const cfg = Object.assign({}, this.template);
      const pos = this._spawnPosition();
      cfg.x = pos.x;
      cfg.y = pos.y;
      for (const [key, fn] of Object.entries(this.randomizers)) {
        cfg[key] = fn(cfg[key]);
      }
      if (cfg.colorStops) {
        cfg.colorStops = cfg.colorStops.map(c => typeof c === 'string' ? Color.parse(c) : c);
      }
      return cfg;
    }
    update(dt, pool) {
      if (!this.active) return;
      this.elapsed += dt;
      if (this.elapsed > this.duration) { this.active = false; return; }
      if (!this._bursted && this.burst > 0) {
        for (let i = 0; i < this.burst; i++) pool.push(new Particle(this._buildParticleConfig()));
        this._bursted = true;
      }
      if (this.rate > 0) {
        this._accumulator += dt * this.rate;
        while (this._accumulator >= 1) {
          pool.push(new Particle(this._buildParticleConfig()));
          this._accumulator--;
        }
      }
    }
  }
  class LineEmitter extends Emitter {
    constructor(config = {}) {
      super(config);
      this.x2 = config.x2 ?? config.x ?? 0;
      this.y2 = config.y2 ?? config.y ?? 0;
    }
    _spawnPosition() {
      const t = Math.random();
      return {
        x: MathUtils.lerp(this.x, this.x2, t),
        y: MathUtils.lerp(this.y, this.y2, t)
      };
    }
  }
  class RectEmitter extends Emitter {
    constructor(config = {}) {
      super(config);
      this.width = config.width ?? 100;
      this.height = config.height ?? 100;
    }
    _spawnPosition() {
      return {
        x: this.x + (Math.random() - 0.5) * this.width,
        y: this.y + (Math.random() - 0.5) * this.height
      };
    }
  }
  class CircleEmitter extends Emitter {
    constructor(config = {}) {
      super(config);
      this.radius = config.radius ?? 50;
      this.onEdge = config.onEdge ?? false;
    }
    _spawnPosition() {
      const angle = Math.random() * Math.PI * 2;
      const r = this.onEdge ? this.radius : Math.random() * this.radius;
      return { x: this.x + Math.cos(angle) * r, y: this.y + Math.sin(angle) * r };
    }
  }
  const Behaviors = {
    bounceEdges: (padding = 0) => (p, system) => {
      const { width, height } = system;
      if (p.x - p.currentSize / 2 < padding) { p.x = padding + p.currentSize / 2; p.vx = Math.abs(p.vx) * p.bounce; }
      if (p.x + p.currentSize / 2 > width - padding) { p.x = width - padding - p.currentSize / 2; p.vx = -Math.abs(p.vx) * p.bounce; }
      if (p.y - p.currentSize / 2 < padding) { p.y = padding + p.currentSize / 2; p.vy = Math.abs(p.vy) * p.bounce; }
      if (p.y + p.currentSize / 2 > height - padding) { p.y = height - padding - p.currentSize / 2; p.vy = -Math.abs(p.vy) * p.bounce; }
    },
    wrapEdges: (padding = 0) => (p, system) => {
      const { width, height } = system;
      if (p.x < -padding) p.x = width + padding;
      if (p.x > width + padding) p.x = -padding;
      if (p.y < -padding) p.y = height + padding;
      if (p.y > height + padding) p.y = -padding;
    },
    killEdges: (padding = 50) => (p, system) => {
      if (p.x < -padding || p.x > system.width + padding ||
        p.y < -padding || p.y > system.height + padding) p.alive = false;
    },
  };
  const Presets = {
    fire: (x, y, options = {}) => ({
      emitter: {
        type: 'circle',
        config: {
          x, y,
          radius: options.radius ?? 20,
          rate: options.rate ?? 80,
          template: {
            life: options.life ?? 1.2,
            startSize: options.size ?? 18,
            endSize: 0,
            vx: 0, vy: 0,
            drag: 0.97,
            shape: 'circle',
            blendMode: 'lighter',
            glowSize: 15,
            turbulence: options.turbulence ?? 0.4,
            turbulenceScale: 0.008,
            colorStops: [
              { r: 255, g: 60, b: 0, a: 0 },
              { r: 255, g: 140, b: 20, a: 0.9 },
              { r: 255, g: 230, b: 80, a: 0.7 },
              { r: 200, g: 200, b: 200, a: 0.0 },
            ],
          },
          randomizers: {
            vx: () => MathUtils.rand(-0.8, 0.8),
            vy: () => MathUtils.rand(-3, -1.5),
            life: v => v * MathUtils.rand(0.7, 1.3),
            startSize: v => v * MathUtils.rand(0.5, 1.5),
            rotation: () => MathUtils.rand(0, Math.PI * 2),
          },
        }
      },
      forces: [
        new GravityForce(0, -3),
        new WindForce(options.wind ?? 0.1, 0),
      ],
    }),
    smoke: (x, y, options = {}) => ({
      emitter: {
        type: 'circle',
        config: {
          x, y,
          radius: options.radius ?? 15,
          rate: options.rate ?? 10,
          template: {
            life: options.life ?? 4,
            startSize: options.size ?? 30,
            endSize: 80,
            vx: 0, vy: 0,
            drag: 0.992,
            shape: 'circle',
            blendMode: 'source-over',
            turbulence: 0.2,
            turbulenceScale: 0.004,
            colorStops: [
              { r: 80, g: 80, b: 80, a: 0 },
              { r: 100, g: 100, b: 100, a: 0.4 },
              { r: 150, g: 150, b: 150, a: 0.2 },
              { r: 180, g: 180, b: 180, a: 0 },
            ],
          },
          randomizers: {
            vx: () => MathUtils.rand(-0.3, 0.3),
            vy: () => MathUtils.rand(-1.5, -0.5),
            life: v => v * MathUtils.rand(0.8, 1.2),
            rotation: () => MathUtils.rand(0, Math.PI * 2),
            rotationSpeed: () => MathUtils.rand(-0.2, 0.2),
          },
        }
      },
      forces: [new GravityForce(0, -0.5)],
    }),
    sparkle: (x, y, options = {}) => ({
      emitter: {
        type: 'circle',
        config: {
          x, y,
          radius: options.radius ?? 60,
          rate: options.rate ?? 40,
          template: {
            life: options.life ?? 1.5,
            startSize: options.size ?? 6,
            endSize: 0,
            drag: 0.985,
            shape: 'star',
            blendMode: 'lighter',
            glowSize: 8,
            trail: true,
            trailLength: 5,
            colorStops: [
              { r: 255, g: 220, b: 100, a: 0 },
              { r: 255, g: 255, b: 200, a: 1 },
              { r: 200, g: 160, b: 255, a: 0 },
            ],
          },
          randomizers: {
            vx: () => MathUtils.rand(-2, 2),
            vy: () => MathUtils.rand(-2, 2),
            life: v => v * MathUtils.rand(0.5, 1.5),
            startSize: v => v * MathUtils.rand(0.4, 1.8),
            rotationSpeed: () => MathUtils.rand(-5, 5),
            rotation: () => Math.random() * Math.PI * 2,
          },
        }
      },
      forces: [new GravityForce(0, 0.3)],
    }),
    snow: (width, options = {}) => ({
      emitter: {
        type: 'line',
        config: {
          x: 0, y: -10,
          x2: width, y2: -10,
          rate: options.rate ?? 30,
          template: {
            life: options.life ?? 8,
            startSize: options.size ?? 5,
            endSize: options.size ?? 5,
            drag: 0.998,
            shape: 'circle',
            blendMode: 'source-over',
            turbulence: 0.15,
            turbulenceScale: 0.003,
            colorStops: [
              { r: 220, g: 235, b: 255, a: 0 },
              { r: 255, g: 255, b: 255, a: 0.9 },
              { r: 200, g: 220, b: 255, a: 0 },
            ],
          },
          randomizers: {
            vx: () => MathUtils.rand(-0.3, 0.3),
            vy: () => MathUtils.rand(0.5, 1.5),
            life: v => v * MathUtils.rand(0.8, 1.2),
            startSize: v => v * MathUtils.rand(0.4, 1.8),
            endSize: v => v * MathUtils.rand(0.4, 1.8),
          },
        }
      },
      forces: [
        new GravityForce(0, 0.5),
        new WindForce(options.wind ?? 0.15, 0),
      ],
    }),
    confetti: (x, y, options = {}) => ({
      emitter: {
        type: 'point',
        config: {
          x, y,
          burst: options.count ?? 120,
          rate: 0,
          template: {
            life: options.life ?? 3,
            startSize: options.size ?? 10,
            endSize: 8,
            drag: 0.985,
            bounce: 0.4,
            shape: 'square',
            blendMode: 'source-over',
            colorStops: null, 
          },
          randomizers: {
            vx: () => MathUtils.rand(-8, 8),
            vy: () => MathUtils.rand(-15, -5),
            life: v => v * MathUtils.rand(0.7, 1.3),
            startSize: v => v * MathUtils.rand(0.5, 1.5),
            rotationSpeed: () => MathUtils.rand(-8, 8),
            rotation: () => Math.random() * Math.PI * 2,
            colorStops: () => {
              const colors = [
                [{ r: 255, g: 80, b: 80, a: 1 }, { r: 255, g: 80, b: 80, a: 0 }],
                [{ r: 255, g: 200, b: 50, a: 1 }, { r: 255, g: 200, b: 50, a: 0 }],
                [{ r: 80, g: 200, b: 120, a: 1 }, { r: 80, g: 200, b: 120, a: 0 }],
                [{ r: 100, g: 150, b: 255, a: 1 }, { r: 100, g: 150, b: 255, a: 0 }],
                [{ r: 220, g: 100, b: 255, a: 1 }, { r: 220, g: 100, b: 255, a: 0 }],
              ];
              return MathUtils.randItem(colors);
            },
          },
        }
      },
      forces: [
        new GravityForce(0, 8),
        new WindForce(options.wind ?? 0.1, 0),
      ],
      behaviors: [Behaviors.bounceEdges(0)],
    }),
    galaxy: (x, y, options = {}) => ({
      emitter: {
        type: 'circle',
        config: {
          x, y,
          radius: options.radius ?? 200,
          onEdge: true,
          rate: options.rate ?? 50,
          template: {
            life: options.life ?? 5,
            startSize: options.size ?? 3,
            endSize: 0,
            drag: 0.999,
            shape: 'circle',
            blendMode: 'lighter',
            glowSize: 6,
            trail: true,
            trailLength: 8,
            colorStops: [
              { r: 100, g: 120, b: 255, a: 0 },
              { r: 180, g: 160, b: 255, a: 0.9 },
              { r: 255, g: 220, b: 255, a: 0.4 },
              { r: 255, g: 255, b: 255, a: 0 },
            ],
          },
          randomizers: {
            life: v => v * MathUtils.rand(0.5, 1.5),
            startSize: v => v * MathUtils.rand(0.5, 2),
            colorStops: (stops) => {
              const hue = MathUtils.rand(200, 320);
              const c = Color.hsl2rgb(hue, 80, 70);
              return [
                { r: c.r, g: c.g, b: c.b, a: 0 },
                { r: c.r, g: c.g, b: c.b, a: 0.9 },
                { r: 255, g: 255, b: 255, a: 0.2 },
                { r: c.r, g: c.g, b: c.b, a: 0 },
              ];
            },
          },
        }
      },
      forces: [],
      behaviors: [],
      onInit: (system) => {
        system.addForce(new VortexForce(x, y, options.spin ?? 30, options.radius ?? 200));
        system.addForce(new AttractorForce(x, y, options.attraction ?? 5, options.radius ?? 220, 'quadratic'));
      },
    }),
    explosion: (x, y, options = {}) => ({
      emitter: {
        type: 'circle',
        config: {
          x, y,
          radius: 5,
          burst: options.count ?? 80,
          rate: 0,
          template: {
            life: options.life ?? 1.2,
            startSize: options.size ?? 8,
            endSize: 0,
            drag: 0.97,
            shape: 'circle',
            blendMode: 'lighter',
            glowSize: 12,
            trail: true,
            trailLength: 6,
            colorStops: [
              { r: 255, g: 240, b: 80, a: 1 },
              { r: 255, g: 100, b: 20, a: 0.8 },
              { r: 150, g: 50, b: 10, a: 0 },
            ],
          },
          randomizers: {
            vx: () => MathUtils.rand(-12, 12),
            vy: () => MathUtils.rand(-12, 12),
            life: v => v * MathUtils.rand(0.5, 1.5),
            startSize: v => v * MathUtils.rand(0.3, 2),
            shape: () => MathUtils.randItem(['circle', 'star', 'spark']),
            rotationSpeed: () => MathUtils.rand(-10, 10),
          },
        }
      },
      forces: [new GravityForce(0, 2)],
    }),
    bubbles: (x, y, options = {}) => ({
      emitter: {
        type: 'circle',
        config: {
          x, y,
          radius: options.radius ?? 40,
          rate: options.rate ?? 15,
          template: {
            life: options.life ?? 4,
            startSize: options.size ?? 20,
            endSize: options.size ?? 20,
            drag: 0.992,
            shape: 'ring',
            blendMode: 'source-over',
            turbulence: 0.1,
            colorStops: [
              { r: 120, g: 200, b: 255, a: 0 },
              { r: 180, g: 230, b: 255, a: 0.6 },
              { r: 255, g: 255, b: 255, a: 0 },
            ],
          },
          randomizers: {
            vx: () => MathUtils.rand(-0.3, 0.3),
            vy: () => MathUtils.rand(-1.5, -0.5),
            life: v => v * MathUtils.rand(0.7, 1.3),
            startSize: v => v * MathUtils.rand(0.5, 2),
            endSize: v => v * MathUtils.rand(0.5, 2),
          },
        }
      },
      forces: [new BuoyancyForce(0.8, 5)],
    }),
  };
  class ParticleSystem {
    constructor(canvas, options = {}) {
      this.canvas = typeof canvas === 'string' ? document.querySelector(canvas) : canvas;
      if (!this.canvas) throw new Error('ParticleJS: Canvas not found');
      this.ctx = this.canvas.getContext('2d');
      this.width = this.canvas.width;
      this.height = this.canvas.height;
      this.particles = [];
      this.emitters = [];
      this.forces = [];
      this.behaviors = [];
      this.maxParticles = options.maxParticles ?? 10000;
      this.background = options.background ?? null;
      this.backgroundAlpha = options.backgroundAlpha ?? 1;
      this.time = 0;
      this.running = false;
      this._raf = null;
      this._lastTime = null;
      this.stats = { fps: 0, particles: 0, emitters: 0 };
      this._fpsSmooth = 0;
      if (options.autoResize) this._setupResize();
      this.pointer = { x: -9999, y: -9999, down: false };
      if (options.trackPointer) this._setupPointer();
      this.onUpdate = options.onUpdate ?? null;
      this.onBeforeDraw = options.onBeforeDraw ?? null;
      this.onAfterDraw = options.onAfterDraw ?? null;
    }
    start() {
      if (this.running) return this;
      this.running = true;
      this._raf = requestAnimationFrame(this._loop.bind(this));
      return this;
    }
    stop() {
      this.running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      return this;
    }
    clear() {
      this.particles = [];
      this.emitters = [];
      return this;
    }
    clearParticles() { this.particles = []; return this; }
    clearEmitters() { this.emitters = []; return this; }
    clearForces() { this.forces = []; return this; }
    destroy() {
      this.stop();
      this._removePointer?.();
      this._removeResize?.();
      this.particles = [];
      this.emitters = [];
      this.forces = [];
    }
    addEmitter(emitter) { this.emitters.push(emitter); return emitter; }
    removeEmitter(emitter) { this.emitters = this.emitters.filter(e => e !== emitter); return this; }
    createEmitter(type = 'point', config = {}) {
      const EmitterClass = { point: Emitter, line: LineEmitter, rect: RectEmitter, circle: CircleEmitter }[type] ?? Emitter;
      return this.addEmitter(new EmitterClass(config));
    }
    addForce(force) { this.forces.push(force); return force; }
    removeForce(force) { this.forces = this.forces.filter(f => f !== force); return this; }
    addBehavior(fn) { this.behaviors.push(fn); return this; }
    usePreset(name, x, y, options = {}) {
      if (!Presets[name]) throw new Error(`ParticleJS: Unknown preset "${name}"`);
      const def = Presets[name](x, y, options);
      if (!def) return this;
      if (def.emitter) {
        const em = this.createEmitter(def.emitter.type ?? 'point', def.emitter.config);
      }
      if (def.forces) def.forces.forEach(f => this.addForce(f));
      if (def.behaviors) def.behaviors.forEach(b => this.addBehavior(b));
      if (def.onInit) def.onInit(this);
      return this;
    }
    usePresetNamed(name, ...args) {
      return this.usePreset(name, ...args);
    }
    burst(x, y, config = {}) {
      const count = config.count ?? 30;
      for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
        const angle = (config.angle ?? Math.random() * Math.PI * 2);
        const spread = config.spread ?? Math.PI * 2;
        const a = angle - spread / 2 + Math.random() * spread;
        const speed = MathUtils.rand(config.minSpeed ?? 1, config.maxSpeed ?? 8);
        this.particles.push(new Particle({
          x, y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          life: MathUtils.rand(config.minLife ?? 0.5, config.maxLife ?? 2),
          startSize: MathUtils.rand(config.minSize ?? 3, config.maxSize ?? 10),
          endSize: config.endSize ?? 0,
          drag: config.drag ?? 0.97,
          shape: config.shape ?? 'circle',
          blendMode: config.blendMode ?? 'source-over',
          glowSize: config.glowSize ?? 0,
          colorStops: config.colorStops ?? [{ r: 255, g: 255, b: 255, a: 1 }, { r: 255, g: 255, b: 255, a: 0 }],
          trail: config.trail ?? false,
          trailLength: config.trailLength ?? 5,
        }));
      }
      return this;
    }
    _loop(ts) {
      if (!this.running) return;
      this._raf = requestAnimationFrame(this._loop.bind(this));
      if (!this._lastTime) this._lastTime = ts;
      let dt = (ts - this._lastTime) / 1000;
      this._lastTime = ts;
      dt = Math.min(dt, 0.05); 
      this.time = ts;
      const fps = 1 / dt;
      this._fpsSmooth = this._fpsSmooth * 0.9 + fps * 0.1;
      this.stats.fps = Math.round(this._fpsSmooth);
      this._update(dt);
      this._draw();
      if (this.onUpdate) this.onUpdate(dt, this);
    }
    _update(dt) {
      for (const em of this.emitters) {
        if (this.particles.length < this.maxParticles) em.update(dt, this.particles);
      }
      this.emitters = this.emitters.filter(em => em.active || em.particles > 0);
      for (const p of this.particles) {
        p.update(dt, this.forces, this);
        for (const b of this.behaviors) b(p, this);
      }
      this.particles = this.particles.filter(p => p.alive);
      this.stats.particles = this.particles.length;
      this.stats.emitters = this.emitters.length;
    }
    _draw() {
      const ctx = this.ctx;
      const { width, height } = this.canvas;
      if (this.onBeforeDraw) { this.onBeforeDraw(ctx, this); }
      else if (this.background) {
        ctx.globalAlpha = this.backgroundAlpha;
        ctx.fillStyle = this.background;
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1;
      } else {
        ctx.clearRect(0, 0, width, height);
      }
      for (const p of this.particles) p.draw(ctx);
      if (this.onAfterDraw) this.onAfterDraw(ctx, this);
    }
    resize(w, h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.width = w;
      this.height = h;
    }
    _setupResize() {
      const fn = () => {
        const parent = this.canvas.parentElement;
        if (parent) this.resize(parent.clientWidth, parent.clientHeight);
      };
      window.addEventListener('resize', fn);
      fn();
      this._removeResize = () => window.removeEventListener('resize', fn);
    }
    _setupPointer() {
      const rect = () => this.canvas.getBoundingClientRect();
      const move = (e) => {
        const r = rect();
        const src = e.touches ? e.touches[0] : e;
        this.pointer.x = src.clientX - r.left;
        this.pointer.y = src.clientY - r.top;
      };
      const down = () => { this.pointer.down = true; };
      const up = () => { this.pointer.down = false; };
      this.canvas.addEventListener('mousemove', move);
      this.canvas.addEventListener('touchmove', move, { passive: true });
      this.canvas.addEventListener('mousedown', down);
      this.canvas.addEventListener('mouseup', up);
      this._removePointer = () => {
        this.canvas.removeEventListener('mousemove', move);
        this.canvas.removeEventListener('touchmove', move);
        this.canvas.removeEventListener('mousedown', down);
        this.canvas.removeEventListener('mouseup', up);
      };
    }
  }
  return {
    ParticleSystem,
    Particle,
    Emitter, LineEmitter, RectEmitter, CircleEmitter,
    Force, GravityForce, WindForce, AttractorForce, RepellerForce, VortexForce, BuoyancyForce,
    Behaviors,
    Presets,
    Color,
    MathUtils,
  };
});
