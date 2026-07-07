import { XmlElement } from "../isomorphism/xmlParser";

export interface AttrUpdate {
    name: string;
    newValue: string;
}

const XY_TAGS = new Set(["rect", "image", "use", "svg", "text", "tspan", "foreignObject"]);
const CXCY_TAGS = new Set(["circle", "ellipse"]);
const POINTS_TAGS = new Set(["polyline", "polygon"]);
const LINE_TAG = "line";

const PHASE1_TAGS = new Set<string>([
    ...XY_TAGS, ...CXCY_TAGS, ...POINTS_TAGS, LINE_TAG
]);

export function isPhase1Shape(tag: string): boolean {
    return PHASE1_TAGS.has(tag);
}

export function computeMoveUpdates(
    element: XmlElement,
    dx: number,
    dy: number,
    decimalPlaces: number
): AttrUpdate[] {
    if (!isPhase1Shape(element.tag)) return [];
    // Phase 2: any pre-existing transform is out of scope. Fall through to full-serialize path.
    if (element.attrs.transform !== undefined) return [];

    if (element.tag === LINE_TAG) return moveLine(element, dx, dy, decimalPlaces);
    if (CXCY_TAGS.has(element.tag)) return moveCxCy(element, dx, dy, decimalPlaces);
    if (POINTS_TAGS.has(element.tag)) return movePoints(element, dx, dy, decimalPlaces);
    return moveXy(element, dx, dy, decimalPlaces);
}

function moveXy(el: XmlElement, dx: number, dy: number, dp: number): AttrUpdate[] {
    const x = parseNum(el.attrs.x);
    const y = parseNum(el.attrs.y);
    return [
        { name: "x", newValue: fmt(x + dx, dp) },
        { name: "y", newValue: fmt(y + dy, dp) }
    ];
}

function moveCxCy(el: XmlElement, dx: number, dy: number, dp: number): AttrUpdate[] {
    const cx = parseNum(el.attrs.cx);
    const cy = parseNum(el.attrs.cy);
    return [
        { name: "cx", newValue: fmt(cx + dx, dp) },
        { name: "cy", newValue: fmt(cy + dy, dp) }
    ];
}

function moveLine(el: XmlElement, dx: number, dy: number, dp: number): AttrUpdate[] {
    const x1 = parseNum(el.attrs.x1);
    const y1 = parseNum(el.attrs.y1);
    const x2 = parseNum(el.attrs.x2);
    const y2 = parseNum(el.attrs.y2);
    return [
        { name: "x1", newValue: fmt(x1 + dx, dp) },
        { name: "y1", newValue: fmt(y1 + dy, dp) },
        { name: "x2", newValue: fmt(x2 + dx, dp) },
        { name: "y2", newValue: fmt(y2 + dy, dp) }
    ];
}

function movePoints(el: XmlElement, dx: number, dy: number, dp: number): AttrUpdate[] {
    const raw = el.attrs.points || "";
    // Preserve the pair separator style: if any pair uses a comma, we treat "x,y" as one token.
    // Points can be given as "x1,y1 x2,y2" or "x1 y1 x2 y2" or a mix; SVG spec allows either.
    const tokens = raw.trim().split(/\s+/).filter(function (t) { return t.length > 0; });
    const usesComma = tokens.some(function (t) { return t.indexOf(",") >= 0; });

    // Flatten into a coordinate array, tracking which separator each pair used.
    const coords: number[] = [];
    for (const tok of tokens) {
        if (tok.indexOf(",") >= 0) {
            const parts = tok.split(",");
            if (parts.length !== 2) return [];
            coords.push(parseNum(parts[0]), parseNum(parts[1]));
        } else {
            coords.push(parseNum(tok));
        }
    }
    if (coords.length === 0 || coords.length % 2 !== 0) return [];

    const shifted: string[] = [];
    for (let i = 0; i < coords.length; i += 2) {
        const nx = fmt(coords[i] + dx, dp);
        const ny = fmt(coords[i + 1] + dy, dp);
        shifted.push(usesComma ? nx + "," + ny : nx + " " + ny);
    }
    return [{ name: "points", newValue: shifted.join(" ") }];
}

function parseNum(v: string | undefined): number {
    if (v === undefined || v === null || v === "") return 0;
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
}

function fmt(n: number, decimalPlaces: number): string {
    // Follow existing convention: fixed decimalPlaces then trim redundant trailing zeros
    // and a trailing decimal point.
    const dp = Math.max(0, Math.floor(decimalPlaces));
    let s = n.toFixed(dp);
    if (s.indexOf(".") >= 0) {
        s = s.replace(/0+$/, "").replace(/\.$/, "");
    }
    // Preserve negative-zero as "0"
    if (s === "-0") s = "0";
    return s;
}
