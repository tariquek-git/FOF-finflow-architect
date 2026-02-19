import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'docs/examples/diagrams');

const VIEWPORT = { width: 1400, height: 700 };
const GRAPH_FRAME = { x: 90, y: 120, width: 1180, height: 330 };
const CONTROL_FRAME = { x: 90, y: 500, width: 1180, height: 130 };

const FONT = {
  title: { size: 28, line: 1.2 },
  nodeTitle: { size: 14, line: 1.25 },
  nodeSub: { size: 12, line: 1.25 },
  edge: { size: 12, line: 1.2 },
  controlTitle: { size: 14, line: 1.25 },
  control: { size: 12, line: 1.35 }
};

const PRESET_CONFIG = {
  pipeline: {
    xStep: 300,
    ySeedStep: 170,
    yMinGap: 150,
    branchGap: 150,
    branchStrength: 0.35,
    edgeCurve: 0.4,
    edgeLabelMid: 0.52,
    edgeLabelOffsets: [-22, -34, 22, 34, -46, 46, 0]
  },
  branch: {
    xStep: 290,
    ySeedStep: 190,
    yMinGap: 165,
    branchGap: 190,
    branchStrength: 0.9,
    edgeCurve: 0.55,
    edgeLabelMid: 0.48,
    edgeLabelOffsets: [-30, 30, -46, 46, -60, 60, 0]
  },
  compact: {
    xStep: 250,
    ySeedStep: 145,
    yMinGap: 130,
    branchGap: 140,
    branchStrength: 0.25,
    edgeCurve: 0.34,
    edgeLabelMid: 0.54,
    edgeLabelOffsets: [-18, -28, 18, 28, -38, 38, 0]
  }
};

const SCENARIOS = [
  {
    id: 'card-settlement',
    heading: 'Example 1: Card Program Authorization to Settlement (T+1)',
    controls: [
      'KYC/KYB before issuance',
      'AML and velocity checks',
      'Daily reconciliation between processor and sponsor bank reports'
    ],
    nodes: [
      { id: 'cardholder', title: 'Cardholder', subtitle: 'Initiates purchase' },
      { id: 'network', title: 'Card Network', subtitle: 'Routes auth + clearing' },
      { id: 'issuer', title: 'Issuer Program', subtitle: 'Approves + hold funds' },
      { id: 'processor', title: 'Processor', subtitle: 'Clearing file + ledger' },
      { id: 'sponsor', title: 'Sponsor Bank', subtitle: 'Net settlement on T+1' }
    ],
    edges: [
      { source: 'cardholder', target: 'network', label: 'Purchase request' },
      { source: 'network', target: 'issuer', label: 'Authorization' },
      { source: 'issuer', target: 'processor', label: 'Clearing events' },
      { source: 'processor', target: 'sponsor', label: 'Settlement batch' }
    ]
  },
  {
    id: 'marketplace-split',
    heading: 'Example 2: Marketplace Split Payout (Platform + Seller)',
    controls: [
      'Versioned split rules',
      'Negative balance prevention',
      'Idempotent payout retries',
      'ACH cutoff handling'
    ],
    nodes: [
      { id: 'buyer', title: 'Buyer', subtitle: 'Pays USD 250' },
      { id: 'wallet', title: 'Platform Wallet', subtitle: 'Receives gross funds' },
      { id: 'splitter', title: 'Splitter Engine', subtitle: 'Apply 92/8 rule' },
      { id: 'seller', title: 'Seller FBO Account', subtitle: 'USD 230 payout leg' },
      { id: 'revenue', title: 'Platform Revenue', subtitle: 'USD 20 fee leg' }
    ],
    edges: [
      { source: 'buyer', target: 'wallet', label: 'Payment' },
      { source: 'wallet', target: 'splitter', label: 'To splitter' },
      { source: 'splitter', target: 'seller', label: 'Seller share 92%' },
      { source: 'splitter', target: 'revenue', label: 'Platform fee 8%' }
    ]
  },
  {
    id: 'remittance',
    heading: 'Example 3: Cross-Border Remittance (USD to MXN)',
    controls: [
      'Sanctions screening before FX lock',
      'Quote expiry and slippage limits',
      'End-to-end trace ID and webhook confirmation'
    ],
    nodes: [
      { id: 'sender', title: 'Sender', subtitle: 'Funds USD 500' },
      { id: 'compliance', title: 'Compliance', subtitle: 'KYC + sanctions pass' },
      { id: 'fx', title: 'FX Engine', subtitle: 'Quote + lock USD/MXN' },
      { id: 'correspondent', title: 'Correspondent Bank', subtitle: 'Receives SWIFT instruction' },
      { id: 'recipient', title: 'Recipient Account', subtitle: 'Credits MXN funds' }
    ],
    edges: [
      { source: 'sender', target: 'compliance', label: 'Funding' },
      { source: 'compliance', target: 'fx', label: 'KYC pass' },
      { source: 'fx', target: 'correspondent', label: 'SWIFT leg' },
      { source: 'correspondent', target: 'recipient', label: 'Credit posted' }
    ]
  }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const estTextWidth = (text, fontSize) => {
  const str = String(text || '');
  let width = 0;
  for (const ch of str) {
    if (ch === ' ') width += fontSize * 0.28;
    else if ('MW@#%&'.includes(ch)) width += fontSize * 0.75;
    else if (ch.toUpperCase() === ch && /[A-Z]/.test(ch)) width += fontSize * 0.62;
    else width += fontSize * 0.56;
  }
  return width;
};

const wrapText = (text, fontSize, maxWidth) => {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines = [];
  let line = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${line} ${words[i]}`;
    if (estTextWidth(candidate, fontSize) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
};

const intersect = (a, b, pad = 0) =>
  a.x < b.x + b.w + pad && a.x + a.w > b.x - pad && a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;

const computeRanks = (nodes, edges) => {
  const inDegree = new Map(nodes.map((n) => [n.id, 0]));
  const outgoing = new Map(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    if (inDegree.has(e.target)) inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    if (outgoing.has(e.source)) outgoing.get(e.source).push(e.target);
  }

  const queue = [];
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) queue.push(id);
  }

  const rank = new Map(nodes.map((n) => [n.id, 0]));
  while (queue.length > 0) {
    const id = queue.shift();
    const nextRank = rank.get(id) || 0;
    for (const target of outgoing.get(id) || []) {
      rank.set(target, Math.max(rank.get(target) || 0, nextRank + 1));
      inDegree.set(target, (inDegree.get(target) || 0) - 1);
      if ((inDegree.get(target) || 0) === 0) queue.push(target);
    }
  }
  return rank;
};

const nodeMetrics = (node) => {
  const titleLines = wrapText(node.title, FONT.nodeTitle.size, 190).slice(0, 2);
  const subLines = wrapText(node.subtitle, FONT.nodeSub.size, 200).slice(0, 2);
  const maxTitle = Math.max(...titleLines.map((line) => estTextWidth(line, FONT.nodeTitle.size)), 120);
  const maxSub = Math.max(...subLines.map((line) => estTextWidth(line, FONT.nodeSub.size)), 100);
  const width = clamp(Math.ceil(Math.max(maxTitle, maxSub) + 42), 180, 260);
  const height = 82 + (titleLines.length - 1) * 16 + (subLines.length - 1) * 14;
  return { titleLines, subLines, width, height };
};

const layoutScenario = (scenario, preset) => {
  const cfg = PRESET_CONFIG[preset] || PRESET_CONFIG.pipeline;
  const nodes = scenario.nodes.map((n) => ({ ...n, ...nodeMetrics(n) }));
  const edges = scenario.edges.map((e) => ({ ...e }));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const rank = computeRanks(nodes, edges);
  const ranks = [...new Set(nodes.map((n) => rank.get(n.id) || 0))].sort((a, b) => a - b);
  const columns = new Map(ranks.map((r) => [r, nodes.filter((n) => (rank.get(n.id) || 0) === r)]));

  for (const r of ranks) {
    const col = columns.get(r) || [];
    col.sort((a, b) => a.id.localeCompare(b.id));
    for (let i = 0; i < col.length; i += 1) col[i].cy = i * cfg.ySeedStep;
  }

  for (let pass = 0; pass < 5; pass += 1) {
    for (const r of ranks.slice(1)) {
      const col = columns.get(r) || [];
      for (const node of col) {
        const preds = edges.filter((e) => e.target === node.id).map((e) => byId.get(e.source)).filter(Boolean);
        if (preds.length) node.cy = preds.reduce((sum, p) => sum + p.cy, 0) / preds.length;
      }
      col.sort((a, b) => a.cy - b.cy);
      for (let i = 1; i < col.length; i += 1) col[i].cy = Math.max(col[i].cy, col[i - 1].cy + cfg.yMinGap);
    }

    for (const r of [...ranks].reverse().slice(1)) {
      const col = columns.get(r) || [];
      for (const node of col) {
        const succ = edges.filter((e) => e.source === node.id).map((e) => byId.get(e.target)).filter(Boolean);
        if (succ.length) node.cy = (node.cy + succ.reduce((sum, s) => sum + s.cy, 0) / succ.length) / 2;
      }
      col.sort((a, b) => a.cy - b.cy);
      for (let i = 1; i < col.length; i += 1) col[i].cy = Math.max(col[i].cy, col[i - 1].cy + cfg.yMinGap);
    }
  }

  // Branch-heavy tuning: spread targets around the branching source to avoid stacked edges.
  for (const source of nodes) {
    const outEdges = edges.filter((e) => e.source === source.id);
    if (outEdges.length < 2) continue;
    const targets = outEdges.map((e) => byId.get(e.target)).filter(Boolean);
    targets.sort((a, b) => a.cy - b.cy);
    const center = source.cy;
    const start = -((targets.length - 1) * cfg.branchGap) / 2;
    for (let i = 0; i < targets.length; i += 1) {
      const preferred = center + start + i * cfg.branchGap;
      targets[i].cy = targets[i].cy * (1 - cfg.branchStrength) + preferred * cfg.branchStrength;
    }
  }

  for (const r of ranks.slice(1)) {
    const col = columns.get(r) || [];
    col.sort((a, b) => a.cy - b.cy);
    for (let i = 1; i < col.length; i += 1) {
      col[i].cy = Math.max(col[i].cy, col[i - 1].cy + cfg.yMinGap);
    }
  }

  const xStep = cfg.xStep;
  for (const node of nodes) {
    node.cx = (rank.get(node.id) || 0) * xStep;
    node.x = node.cx - node.width / 2;
    node.y = node.cy - node.height / 2;
  }

  const rawBounds = nodes.reduce(
    (acc, n) => ({
      minX: Math.min(acc.minX, n.x),
      minY: Math.min(acc.minY, n.y),
      maxX: Math.max(acc.maxX, n.x + n.width),
      maxY: Math.max(acc.maxY, n.y + n.height)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  const rawW = Math.max(1, rawBounds.maxX - rawBounds.minX);
  const rawH = Math.max(1, rawBounds.maxY - rawBounds.minY);
  const scale = Math.min(GRAPH_FRAME.width / rawW, GRAPH_FRAME.height / rawH);

  const fittedW = rawW * scale;
  const fittedH = rawH * scale;
  const tx = GRAPH_FRAME.x + (GRAPH_FRAME.width - fittedW) / 2 - rawBounds.minX * scale;
  const ty = GRAPH_FRAME.y + (GRAPH_FRAME.height - fittedH) / 2 - rawBounds.minY * scale;

  for (const node of nodes) {
    node.x = node.x * scale + tx;
    node.y = node.y * scale + ty;
    node.width *= scale;
    node.height *= scale;
  }

  const nodeBoxes = nodes.map((n) => ({ x: n.x, y: n.y, w: n.width, h: n.height }));
  const labelBoxes = [];

  const drawEdges = edges.map((edge) => {
    const s = byId.get(edge.source);
    const t = byId.get(edge.target);
    if (!s || !t) return null;

    const sx = s.x + s.width;
    const sy = s.y + s.height / 2;
    const tx2 = t.x;
    const ty2 = t.y + t.height / 2;

    const dx = Math.max(60, (tx2 - sx) * cfg.edgeCurve);
    const c1x = sx + dx;
    const c1y = sy;
    const c2x = tx2 - dx;
    const c2y = ty2;

    const d = `M ${sx.toFixed(2)} ${sy.toFixed(2)} C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${tx2.toFixed(2)} ${ty2.toFixed(2)}`;

    const tMid = cfg.edgeLabelMid;
    const inv = 1 - tMid;
    const mx = inv ** 3 * sx + 3 * inv ** 2 * tMid * c1x + 3 * inv * tMid ** 2 * c2x + tMid ** 3 * tx2;
    const my = inv ** 3 * sy + 3 * inv ** 2 * tMid * c1y + 3 * inv * tMid ** 2 * c2y + tMid ** 3 * ty2;

    const labelW = Math.ceil(estTextWidth(edge.label, FONT.edge.size) + 12);
    const labelH = 18;
    const offsets = cfg.edgeLabelOffsets;

    let chosen = { x: mx - labelW / 2, y: my - labelH / 2 };
    for (const off of offsets) {
      const candidate = { x: mx - labelW / 2, y: my + off - labelH / 2, w: labelW, h: labelH };
      const blocked = nodeBoxes.some((b) => intersect(candidate, b, 4)) || labelBoxes.some((b) => intersect(candidate, b, 2));
      if (!blocked) {
        chosen = { x: candidate.x, y: candidate.y };
        labelBoxes.push(candidate);
        break;
      }
    }

    return {
      ...edge,
      path: d,
      labelX: chosen.x + 6,
      labelY: chosen.y + 12,
      labelRectX: chosen.x,
      labelRectY: chosen.y,
      labelRectW: labelW,
      labelRectH: labelH
    };
  }).filter(Boolean);

  return { scenario, nodes, edges: drawEdges };
};

const esc = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const renderSvg = ({ scenario, nodes, edges }) => {
  const lines = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${VIEWPORT.width}" height="${VIEWPORT.height}" viewBox="0 0 ${VIEWPORT.width} ${VIEWPORT.height}" role="img" aria-label="${esc(scenario.heading)}">`);
  lines.push('<defs>');
  lines.push('<marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#475569"/></marker>');
  lines.push('<style>.title{font:700 28px Inter,Segoe UI,sans-serif;fill:#0f172a}.label{font:600 14px Inter,Segoe UI,sans-serif;fill:#0f172a}.sub{font:500 12px Inter,Segoe UI,sans-serif;fill:#334155}.edge{stroke:#64748b;stroke-width:2.5;fill:none;marker-end:url(#arrow)}.edgeText{font:600 12px Inter,Segoe UI,sans-serif;fill:#334155}.edgePill{fill:#f8fafc;stroke:#e2e8f0;stroke-width:1;rx:6}.box{fill:#fff;stroke:#cbd5e1;stroke-width:1.4;rx:12}</style>');
  lines.push('</defs>');

  lines.push('<rect width="100%" height="100%" fill="#f8fafc"/>');
  lines.push(`<text x="48" y="56" class="title">${esc(scenario.heading)}</text>`);

  for (const edge of edges) {
    lines.push(`<path d="${edge.path}" class="edge"/>`);
    lines.push(`<rect x="${edge.labelRectX.toFixed(2)}" y="${edge.labelRectY.toFixed(2)}" width="${edge.labelRectW}" height="${edge.labelRectH}" class="edgePill"/>`);
    lines.push(`<text x="${edge.labelX.toFixed(2)}" y="${edge.labelY.toFixed(2)}" class="edgeText">${esc(edge.label)}</text>`);
  }

  for (const node of nodes) {
    lines.push(`<rect x="${node.x.toFixed(2)}" y="${node.y.toFixed(2)}" width="${node.width.toFixed(2)}" height="${node.height.toFixed(2)}" class="box"/>`);
    const titleY = node.y + 30;
    node.titleLines.forEach((line, index) => {
      lines.push(`<text x="${(node.x + 20).toFixed(2)}" y="${(titleY + index * 18).toFixed(2)}" class="label">${esc(line)}</text>`);
    });

    const subStartY = titleY + node.titleLines.length * 18 + 6;
    node.subLines.forEach((line, index) => {
      lines.push(`<text x="${(node.x + 20).toFixed(2)}" y="${(subStartY + index * 16).toFixed(2)}" class="sub">${esc(line)}</text>`);
    });
  }

  lines.push(`<rect x="${CONTROL_FRAME.x}" y="${CONTROL_FRAME.y}" width="${CONTROL_FRAME.width}" height="${CONTROL_FRAME.height}" fill="#eef2ff" stroke="#c7d2fe" rx="12"/>`);
  lines.push(`<text x="${CONTROL_FRAME.x + 25}" y="${CONTROL_FRAME.y + 35}" class="label">Controls</text>`);

  const controlText = scenario.controls.join(' - ');
  const controlLines = wrapText(controlText, FONT.control.size, CONTROL_FRAME.width - 50).slice(0, 3);
  controlLines.forEach((line, i) => {
    lines.push(`<text x="${CONTROL_FRAME.x + 25}" y="${CONTROL_FRAME.y + 58 + i * 20}" class="sub">${esc(line)}</text>`);
  });

  lines.push('</svg>');
  return `${lines.join('')}\n`;
};

const renderIndexHtml = (scenarios) => {
  const sections = scenarios
    .map(
      (scenario, i) => `<section><h2>${i + 1}) ${esc(scenario.heading.replace(/^Example \d+:\s*/, ''))}</h2><img src="./${scenario.id}.svg" alt="${esc(scenario.heading)}" /></section>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>FinFlow - Flow of Funds Diagram Examples (Auto-fit)</title>
<style>
body{margin:0;font-family:Inter,-apple-system,Segoe UI,sans-serif;background:#f1f5f9;color:#0f172a}
main{max-width:1460px;margin:20px auto;padding:16px}
h1{font-size:24px;margin:8px 0 16px}
section{background:#fff;border:1px solid #dbe2ea;border-radius:12px;padding:12px;margin-bottom:16px}
h2{font-size:16px;margin:0 0 8px}
img{width:100%;border-radius:8px;display:block}
</style>
</head>
<body>
<main>
<h1>FinFlow - Flow of Funds Diagram Examples (Auto-fit)</h1>
${sections}
</main>
</body>
</html>\n`;
};

const extractPdfText = async (pdfPath, outPath) => {
  try {
    const { spawnSync } = await import('node:child_process');
    const script = [
      'from pathlib import Path',
      'from pypdf import PdfReader',
      `pdf = Path(r"${pdfPath}")`,
      `out = Path(r"${outPath}")`,
      'reader = PdfReader(str(pdf))',
      'parts=[]',
      'for i,p in enumerate(reader.pages, start=1):',
      '    text=(p.extract_text() or "").strip()',
      '    parts.append(f"--- Page {i} ---\\n{text}")',
      'out.write_text("\\n\\n".join(parts), encoding="utf-8")'
    ].join('\n');
    const result = spawnSync('python3', ['-c', script], { encoding: 'utf-8' });
    if (result.status !== 0) {
      console.warn('PDF extract skipped (python/pypdf unavailable).');
      if (result.stderr) console.warn(result.stderr.trim());
    }
  } catch {
    console.warn('PDF extract skipped (python/pypdf unavailable).');
  }
};

const parsePresetArg = () => {
  const raw = process.argv.find((arg) => arg.startsWith('--preset='))?.split('=')[1] || 'pipeline';
  return Object.prototype.hasOwnProperty.call(PRESET_CONFIG, raw) ? raw : 'pipeline';
};

const main = async () => {
  const preset = parsePresetArg();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const layouts = SCENARIOS.map((scenario) => layoutScenario(scenario, preset));
  for (const layout of layouts) {
    const svg = renderSvg(layout);
    fs.writeFileSync(path.join(OUT_DIR, `${layout.scenario.id}.svg`), svg, 'utf8');
  }

  fs.writeFileSync(path.join(OUT_DIR, 'flow-of-funds-diagrams.html'), renderIndexHtml(SCENARIOS), 'utf8');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });

  for (const scenario of SCENARIOS) {
    const svgRaw = fs.readFileSync(path.join(OUT_DIR, `${scenario.id}.svg`), 'utf8');
    await page.setContent(svgRaw, { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: path.join(OUT_DIR, `${scenario.id}.png`) });
  }

  await page.goto(`file://${path.join(OUT_DIR, 'flow-of-funds-diagrams.html')}`, { waitUntil: 'networkidle' });
  const pdfPath = path.join(OUT_DIR, 'flow-of-funds-diagrams.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' }
  });

  await browser.close();

  await extractPdfText(pdfPath, path.join(OUT_DIR, 'flow-of-funds-diagrams.extract.txt'));

  console.log(`Auto-fit diagrams generated in ${OUT_DIR} using preset=${preset}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
