import type { SpritemapJson } from "./adobe-animate-spritemap";

export type Direction4 = "front" | "right" | "left" | "back";

export type WalkMode = "sober" | "super";

export type CharacterAnimKey = `${WalkMode}_${Direction4}`;

type LabelFrame = { N: string; I: number; DU: number };
type ImageFrame = { I: number; E: { ASI?: { N: string; M3D?: number[] } }[] };

const SOBER: Direction4[] = ["front", "right", "left", "back"];
const SUPER: Direction4[] = ["front", "right", "left", "back"];

function toKey(mode: WalkMode, dir: Direction4): CharacterAnimKey {
  return `${mode}_${dir}` as CharacterAnimKey;
}

function buildKeys(): string[] {
  const out: string[] = [];
  for (const d of SOBER) out.push(`walk_sober_${d}`);
  for (const d of SUPER) out.push(`super_${d}`);
  return out;
}

const EXPECTED_LABELS = new Set(buildKeys());

/**
 * แปลง Adobe Animate JSON export + spritemap เป็นลำดับชื่อสไปรต์ต่อเฟรม
 */
export function parseAnimateCharacter(animationRoot: unknown, spritemap: SpritemapJson): Map<CharacterAnimKey, string[]> {
  const spriteRects = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const entry of spritemap.ATLAS.SPRITES) {
    const s = entry.SPRITE;
    spriteRects.set(s.name, { x: s.x, y: s.y, w: s.w, h: s.h });
  }

  const root = animationRoot as {
    AN?: {
      TL?: {
        L?: { LN?: string; FR?: unknown[] }[];
      };
    };
  };
  const layers = root.AN?.TL?.L;
  if (!layers?.length) {
    return new globalThis.Map();
  }

  let labelFrames: LabelFrame[] = [];
  const timelineSprites = new Map<number, string>();

  for (const layer of layers) {
    if (layer.LN === "label" && Array.isArray(layer.FR)) {
      labelFrames = layer.FR.filter((f): f is LabelFrame => {
        const x = f as LabelFrame;
        return typeof x?.N === "string" && typeof x?.I === "number" && typeof x?.DU === "number";
      });
    }
    if (layer.LN === "images" && Array.isArray(layer.FR)) {
      for (const fr of layer.FR as ImageFrame[]) {
        if (typeof fr?.I !== "number") continue;
        const name = fr.E?.[0]?.ASI?.N;
        if (typeof name === "string") {
          timelineSprites.set(fr.I, name);
        }
      }
    }
  }

  const result = new Map<CharacterAnimKey, string[]>();

  for (const lf of labelFrames) {
    if (!EXPECTED_LABELS.has(lf.N)) continue;

    const seq: string[] = [];
    for (let i = 0; i < lf.DU; i++) {
      const tf = lf.I + i;
      const spriteName = timelineSprites.get(tf);
      if (!spriteName || !spriteRects.has(spriteName)) break;
      seq.push(spriteName);
    }

    let key: CharacterAnimKey | null = null;
    if (lf.N.startsWith("walk_sober_")) {
      const dir = lf.N.replace("walk_sober_", "") as Direction4;
      key = toKey("sober", dir);
    } else if (lf.N.startsWith("super_")) {
      const dir = lf.N.replace("super_", "") as Direction4;
      key = toKey("super", dir);
    }
    if (key && seq.length > 0) {
      result.set(key, seq);
    }
  }

  return result;
}

export function getSpriteRect(spritemap: SpritemapJson, name: string): { x: number; y: number; w: number; h: number } | null {
  for (const entry of spritemap.ATLAS.SPRITES) {
    const s = entry.SPRITE;
    if (s.name === name) {
      return { x: s.x, y: s.y, w: s.w, h: s.h };
    }
  }
  return null;
}
