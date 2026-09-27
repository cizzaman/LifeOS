import type { ChartDataPoint } from "@/hooks/useChartData";

// ─── Types ───

export interface ChartDimensions {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

export interface ChartConfig {
  maxDataPoints: number;
  animationDuration: number;
  barWidth: number;
  barGap: number;
  colors: ChartColors;
}

/** Canvas cannot read CSS variables, so the palette tokens are resolved once per renderer. */
export interface ChartColors {
  primary: string;
  axis: string;
  grid: string;
  text: string;
  label: string;
  ink: string;
  surface: string;
}

export function chartColorsFromTokens(): ChartColors {
  const css = typeof window !== "undefined" ? getComputedStyle(document.documentElement) : null;
  const read = (name: string, fallback: string) => css?.getPropertyValue(name).trim() || fallback;
  return {
    primary: read("--accent-blue", "#3fb2c9"),
    axis: read("--line-3", "#3a3a3a"),
    grid: read("--line-1", "#1f1f1f"),
    text: read("--ink-3", "#6b7d89"),
    label: read("--ink-2", "#98a8b3"),
    ink: read("--ink-1", "#f0e8d8"),
    surface: read("--surface-1", "#111111"),
  };
}

// ─── Agent Color Map — the one data colour per agent (canvas key + legend pill) ───

const AGENT_COLORS: Record<string, string> = {
  pentester: "#f87171",
  engineer: "#3fb2c9",
  designer: "#a78bfa",
  architect: "#a78bfa",
  intern: "#3fb2c9",
  artist: "#3fb2c9",
  "perplexity-researcher": "#f5c451",
  "claude-researcher": "#f5c451",
  "gemini-researcher": "#f5c451",
  main: "#3fb2c9",
  da: "#3fb2c9",
  pai: "#3fb2c9",
  "claude-code": "#3fb2c9",
};

export function agentColor(name: string): string {
  return AGENT_COLORS[name.split(":")[0].toLowerCase()] || "#3fb2c9";
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  PreToolUse: "Pre-Tool",
  PostToolUse: "Post-Tool",
  UserPromptSubmit: "Prompt",
  SessionStart: "Session Start",
  SessionEnd: "Session End",
  Stop: "Stop",
  SubagentStop: "Subagent",
  PreCompact: "Compact",
  Notification: "Notification",
  Completed: "Completed",
};

const LABEL_FONT = '400 10px "Fira Code", ui-monospace, monospace';

// ─── Renderer Class ───

export class ChartRenderer {
  private ctx: CanvasRenderingContext2D;
  private dimensions: ChartDimensions;
  private config: ChartConfig;
  private animationId: number | null = null;
  private currentFrameLabels: { x: number; y: number; width: number; height: number }[] = [];

  constructor(canvas: HTMLCanvasElement, dimensions: ChartDimensions, config: ChartConfig) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");
    this.ctx = ctx;
    this.dimensions = dimensions;
    this.config = config;
    this.setupCanvas(canvas);
  }

  private setupCanvas(canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = this.dimensions.width * dpr;
    canvas.height = this.dimensions.height * dpr;
    canvas.style.width = `${this.dimensions.width}px`;
    canvas.style.height = `${this.dimensions.height}px`;
    this.ctx.scale(dpr, dpr);
  }

  private getChartArea() {
    const { width, height, padding } = this.dimensions;
    return {
      x: padding.left,
      y: padding.top,
      width: width - padding.left - padding.right,
      height: height - padding.top - padding.bottom,
    };
  }

  // ─── Collision Detection ───

  private calculateNonOverlappingPosition(
    chartArea: { x: number; y: number; width: number; height: number },
    preferredX: number,
    labelWidth: number
  ): { x: number; y: number } | null {
    const LABEL_HEIGHT = 32;
    const MIN_SPACING = 6;
    const MAX_H_OFFSET = 80;
    const H_STEP = 20;

    const minY = chartArea.y + 20;
    const maxY = chartArea.y + chartArea.height - LABEL_HEIGHT - 10;
    const verticalRange = maxY - minY;
    const labelIndex = this.currentFrameLabels.length;
    const preferredY = minY + ((labelIndex * 47) % verticalRange);

    if (this.currentFrameLabels.length === 0) {
      return { x: preferredX, y: minY };
    }

    const hasOverlap = (cx: number, cy: number): boolean => {
      for (const ex of this.currentFrameLabels) {
        const cR = cx + labelWidth;
        const cB = cy + LABEL_HEIGHT;
        const eR = ex.x + ex.width;
        const eB = ex.y + ex.height;
        if (cx - MIN_SPACING < eR && cR + MIN_SPACING > ex.x && cy - MIN_SPACING < eB && cB + MIN_SPACING > ex.y) {
          return true;
        }
      }
      return false;
    };

    const vStep = LABEL_HEIGHT + MIN_SPACING;
    const tryPositions: number[] = [preferredY];
    for (let offset = vStep; offset <= verticalRange; offset += vStep) {
      if (preferredY + offset <= maxY) tryPositions.push(preferredY + offset);
      if (preferredY - offset >= minY) tryPositions.push(preferredY - offset);
    }

    for (const y of tryPositions) {
      if (!hasOverlap(preferredX, y)) return { x: preferredX, y };
      for (let off = H_STEP; off <= MAX_H_OFFSET; off += H_STEP) {
        const rx = preferredX + off;
        if (rx + labelWidth <= chartArea.x + chartArea.width - MIN_SPACING && !hasOverlap(rx, y)) {
          return { x: rx, y };
        }
        const lx = preferredX - off;
        if (lx >= chartArea.x + MIN_SPACING && !hasOverlap(lx, y)) {
          return { x: lx, y };
        }
      }
    }

    return null;
  }

  // ─── Drawing Methods ───

  clear() {
    this.ctx.clearRect(0, 0, this.dimensions.width, this.dimensions.height);
    this.currentFrameLabels = [];
  }

  /** The chart sits on the ground; there is no plot fill to paint. */
  drawBackground() {}

  drawAxes() {
    const area = this.getChartArea();
    const y = Math.round(area.y + area.height) + 0.5;
    this.ctx.save();
    this.ctx.strokeStyle = this.config.colors.axis;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(area.x, y);
    this.ctx.lineTo(area.x + area.width, y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawTimeLabels(timeRange: string) {
    const area = this.getChartArea();
    const labels = this.getTimeLabels(timeRange);
    const spacing = area.width / (labels.length - 1);

    // Grid lines
    this.ctx.save();
    this.ctx.strokeStyle = this.config.colors.grid;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([2, 4]);
    labels.forEach((_, i) => {
      const x = Math.round(area.x + i * spacing) + 0.5;
      this.ctx.beginPath();
      this.ctx.moveTo(x, area.y);
      this.ctx.lineTo(x, area.y + area.height);
      this.ctx.stroke();
    });
    this.ctx.restore();

    // Text labels
    this.ctx.fillStyle = this.config.colors.text;
    this.ctx.font = LABEL_FONT;
    this.ctx.textBaseline = "top";
    labels.forEach((label, i) => {
      const x = area.x + i * spacing;
      const y = area.y + area.height + 10;
      this.ctx.textAlign = i === 0 ? "left" : i === labels.length - 1 ? "right" : "center";
      this.ctx.fillText(label, x, y);
    });
  }

  private getTimeLabels(timeRange: string): string[] {
    const map: Record<string, string[]> = {
      "1M": ["60s", "45s", "30s", "15s", "Now"],
      "2M": ["2m", "90s", "1m", "30s", "Now"],
      "4M": ["4m", "3m", "2m", "1m", "Now"],
      "8M": ["8m", "6m", "4m", "2m", "Now"],
      "16M": ["16m", "12m", "8m", "4m", "Now"],
    };
    return map[timeRange] || map["1M"];
  }

  drawBars(dataPoints: ChartDataPoint[], maxValue: number, progress: number = 1) {
    const area = this.getChartArea();
    const barCount = this.config.maxDataPoints;
    const totalBarWidth = area.width / barCount;
    const barWidth = this.config.barWidth;

    dataPoints.forEach((point, index) => {
      if (point.count === 0) return;

      const x = area.x + index * totalBarWidth + (totalBarWidth - barWidth) / 2;
      const barHeight = (point.count / maxValue) * area.height * progress;

      // Vertical guide + the count as a hairline in the series colour
      const cx = Math.round(x + barWidth / 2) + 0.5;
      const baseY = area.y + area.height;
      this.ctx.save();
      this.ctx.lineWidth = 1;
      this.ctx.strokeStyle = this.config.colors.grid;
      this.ctx.beginPath();
      this.ctx.moveTo(cx, area.y);
      this.ctx.lineTo(cx, baseY - barHeight);
      this.ctx.stroke();
      this.ctx.strokeStyle = this.config.colors.primary;
      this.ctx.beginPath();
      this.ctx.moveTo(cx, baseY - barHeight);
      this.ctx.lineTo(cx, baseY);
      this.ctx.stroke();
      this.ctx.restore();

      // Skip labels for short bars
      if (barHeight <= 10) return;
      if (!point.eventTypes || Object.keys(point.eventTypes).length === 0) return;

      const entries = Object.entries(point.eventTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      if (entries.length === 0) return;

      this.ctx.save();

      // Get dominant app name
      let appName = "";
      let keyColor = this.config.colors.primary;
      if (point.apps && Object.keys(point.apps).length > 0) {
        const dominant = Object.entries(point.apps).sort((a, b) => b[1] - a[1])[0];
        appName = dominant[0];
        keyColor = agentColor(appName);
      }

      const rawDisplayName = appName ? appName.split(":")[0] : "";
      const displayName = rawDisplayName ? rawDisplayName.charAt(0).toUpperCase() + rawDisplayName.slice(1) : "";

      // Get dominant tool name
      let toolName = "";
      if (point.rawEvents && point.rawEvents.length > 0) {
        const toolCounts: Record<string, number> = {};
        for (const ev of point.rawEvents) {
          const t = ev.payload?.tool_name;
          if (t) toolCounts[t] = (toolCounts[t] || 0) + 1;
        }
        if (Object.keys(toolCounts).length > 0) {
          toolName = Object.entries(toolCounts).sort((a, b) => b[1] - a[1])[0][0];
        }
      }

      const eventTypeLabel = EVENT_TYPE_LABELS[entries[0][0]] || entries[0][0];

      // One figure label: 7px agent key, then agent · event · tool in mono
      const segments = [
        { text: displayName, color: this.config.colors.ink },
        { text: eventTypeLabel, color: this.config.colors.label },
        { text: toolName, color: this.config.colors.label },
      ].filter((seg) => seg.text);

      this.ctx.font = LABEL_FONT;
      const KEY = 7;
      const KEY_GAP = 7;
      const SEP = " · ";
      const sepW = this.ctx.measureText(SEP).width;
      const widths = segments.map((seg) => this.ctx.measureText(seg.text).width);
      const textW = widths.reduce((sum, w) => sum + w, 0) + sepW * Math.max(0, segments.length - 1);
      const padding = 9;
      const bgWidth = padding * 2 + KEY + KEY_GAP + textW;
      const bgHeight = 24;

      const centerX = x + barWidth / 2;
      const preferredBgX = centerX - bgWidth / 2;

      const position = this.calculateNonOverlappingPosition(area, preferredBgX, bgWidth);

      if (position === null) {
        // Fallback: small flat dot in the agent colour
        this.ctx.fillStyle = keyColor;
        this.ctx.beginPath();
        this.ctx.arc(centerX, baseY - barHeight / 2, 3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
        return;
      }

      const bgX = Math.round(position.x) + 0.5;
      const bgY = Math.round(position.y) + 0.5;
      const labelY = bgY + bgHeight / 2;

      this.currentFrameLabels.push({ x: bgX, y: bgY, width: bgWidth, height: bgHeight });

      // Leader line if offset
      if (Math.abs(bgX - preferredBgX) > 5) {
        this.ctx.save();
        this.ctx.strokeStyle = this.config.colors.axis;
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([3, 3]);
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, baseY - barHeight / 2);
        this.ctx.lineTo(bgX + bgWidth / 2, labelY);
        this.ctx.stroke();
        this.ctx.restore();
      }

      // Label box — the tooltip surface with a figure-line border
      this.drawRoundedRect(bgX, bgY, bgWidth, bgHeight, 10);
      this.ctx.fillStyle = this.config.colors.surface;
      this.ctx.fill();
      this.ctx.strokeStyle = this.config.colors.axis;
      this.ctx.lineWidth = 1;
      this.ctx.stroke();

      // 7px key: outlined square with a faint tint of its own colour
      const keyX = Math.round(bgX + padding) + 0.5;
      const keyY = Math.round(labelY - KEY / 2) + 0.5;
      this.ctx.save();
      this.ctx.globalAlpha = 0.14;
      this.ctx.fillStyle = keyColor;
      this.ctx.fillRect(keyX, keyY, KEY - 1, KEY - 1);
      this.ctx.restore();
      this.ctx.strokeStyle = keyColor;
      this.ctx.strokeRect(keyX, keyY, KEY - 1, KEY - 1);

      let currentX = bgX + padding + KEY + KEY_GAP;
      this.ctx.textAlign = "left";
      this.ctx.textBaseline = "middle";
      segments.forEach((seg, i) => {
        if (i > 0) {
          this.ctx.fillStyle = this.config.colors.text;
          this.ctx.fillText(SEP, currentX, labelY);
          currentX += sepW;
        }
        this.ctx.fillStyle = seg.color;
        this.ctx.fillText(seg.text, currentX, labelY);
        currentX += widths[i];
      });

      this.ctx.restore();
    });
  }

  stopAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  resize(dimensions: ChartDimensions) {
    this.dimensions = dimensions;
    this.setupCanvas(this.ctx.canvas as HTMLCanvasElement);
  }

  // ─── Helpers ───

  private drawRoundedRect(x: number, y: number, w: number, h: number, r: number) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
  }
}

export function createChartRenderer(canvas: HTMLCanvasElement, dimensions: ChartDimensions, config: ChartConfig) {
  return new ChartRenderer(canvas, dimensions, config);
}
