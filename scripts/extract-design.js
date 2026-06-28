const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const sites = [
  {
    name: 'vitality',
    url: 'https://vitality.sumitomolife.co.jp/',
    label: '住友生命Vitality'
  },
  {
    name: 'felissimo',
    url: 'https://www.felissimo.co.jp/gopeace/fundreport/',
    label: 'フェリシモ gopeace'
  },
  {
    name: 'hrn',
    url: 'https://hrn.or.jp/monthly_supporter/',
    label: 'HRN 月額サポーター'
  }
];

async function extractDesign(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const data = await page.evaluate(() => {
    // Color extraction
    const elements = document.querySelectorAll('*');
    const colorMap = {};
    const toHex = (color) => {
      if (!color || color === 'rgba(0, 0, 0, 0)' || color === 'transparent') return null;
      const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return null;
      return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
    };
    elements.forEach(el => {
      const s = getComputedStyle(el);
      [s.backgroundColor, s.color, s.borderColor].forEach(c => {
        const h = toHex(c);
        if (h) colorMap[h] = (colorMap[h] || 0) + 1;
      });
    });
    const topColors = Object.entries(colorMap)
      .filter(([h]) => h !== '#000000' && h !== '#ffffff')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([h, count]) => ({ hex: h, count }));

    // Font extraction
    const fontMap = {};
    elements.forEach(el => {
      const f = getComputedStyle(el).fontFamily;
      if (f) fontMap[f] = (fontMap[f] || 0) + 1;
    });
    const topFonts = Object.entries(fontMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f]) => f);

    // Type scale from headings/body
    const typeScale = {};
    ['h1','h2','h3','p','body'].forEach(sel => {
      const el = document.querySelector(sel);
      if (el) {
        const s = getComputedStyle(el);
        typeScale[sel] = {
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          lineHeight: s.lineHeight,
          letterSpacing: s.letterSpacing,
          fontFamily: s.fontFamily.split(',')[0].trim()
        };
      }
    });

    // Spacing
    const sections = document.querySelectorAll('section, .section, [class*="section"]');
    const spacings = [];
    sections.forEach(s => {
      const cs = getComputedStyle(s);
      spacings.push({ paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom });
    });

    // Border radius
    const radii = {};
    ['button','a','.btn','[class*="btn"]','[class*="card"]'].forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const r = getComputedStyle(el).borderRadius;
        if (r && r !== '0px') radii[r] = (radii[r] || 0) + 1;
      });
    });

    // Section order
    const sectionOrder = [];
    document.querySelectorAll('section, header, footer, main > div, [class*="hero"], [class*="section"]').forEach(el => {
      const classes = el.className.toString().slice(0, 60);
      const text = el.innerText?.slice(0, 40).replace(/\n/g, ' ');
      sectionOrder.push({ tag: el.tagName, classes, text });
    });

    // CTA
    const ctaEls = document.querySelectorAll('a[href], button');
    const ctas = [];
    ctaEls.forEach(el => {
      const text = el.innerText?.trim();
      const s = getComputedStyle(el);
      if (text && text.length > 2 && text.length < 40) {
        ctas.push({ text, bg: s.backgroundColor, color: s.color, href: el.href || '' });
      }
    });

    return { topColors, topFonts, typeScale, spacings: spacings.slice(0, 5), radii, sectionOrder: sectionOrder.slice(0, 15), ctas: ctas.slice(0, 8) };
  });

  return data;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = {};

  for (const site of sites) {
    const dir = path.join('design-refs', site.name);
    fs.mkdirSync(dir, { recursive: true });

    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log(`Processing ${site.label}...`);
    try {
      const data = await extractDesign(page, site.url);

      // Screenshots
      await page.screenshot({ path: path.join(dir, 'above-fold.png'), clip: { x: 0, y: 0, width: 1440, height: 900 } });
      await page.screenshot({ path: path.join(dir, 'full.png'), fullPage: true });

      results[site.name] = { label: site.label, url: site.url, ...data };
      fs.writeFileSync(path.join(dir, 'extract.json'), JSON.stringify(results[site.name], null, 2));
      console.log(`  Done: ${site.name}`);
    } catch (e) {
      console.error(`  Error on ${site.name}:`, e.message);
      results[site.name] = { error: e.message };
    }
    await page.close();
  }

  await browser.close();
  fs.writeFileSync('design-refs/all-extract.json', JSON.stringify(results, null, 2));
  console.log('All done. Results in design-refs/*/extract.json');
})();
