import sharp from 'sharp';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs><radialGradient id="g" cx="50%" cy="-10%" r="80%"><stop offset="0" stop-color="#efe7ff"/><stop offset="1" stop-color="#ffffff"/></radialGradient></defs>
<rect width="1200" height="630" fill="url(#g)"/>
<g transform="translate(80 84) scale(2.2)"><path d="M16 2 28 9v14l-12 7L4 23V9z" fill="none" stroke="#7b3cff" stroke-width="2.4"/><path d="M16 9 22 12.5v7L16 23l-6-3.5v-7z" fill="#7b3cff"/></g>
<text x="170" y="136" font-family="IBM Plex Sans, Helvetica, Arial, sans-serif" font-size="46" font-weight="700" fill="#15121f">kernel2<tspan font-weight="400" fill="#7b3cff">cloud</tspan></text>
<text x="80" y="340" font-family="IBM Plex Sans, Helvetica, Arial, sans-serif" font-size="84" font-weight="700" fill="#15121f" letter-spacing="-2">AI compute from</text>
<text x="80" y="438" font-family="IBM Plex Sans, Helvetica, Arial, sans-serif" font-size="84" font-weight="300" fill="#7b3cff" letter-spacing="-2">racks in your neighbourhood</text>
<text x="80" y="548" font-family="IBM Plex Mono, monospace" font-size="28" fill="#8b889a">NVIDIA RTX PRO 6000 Blackwell · one pool · one endpoint</text>
</svg>`;
await sharp(Buffer.from(svg)).png().toFile('public/og-default.png');
