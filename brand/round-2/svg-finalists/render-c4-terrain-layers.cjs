/* eslint-disable @typescript-eslint/no-require-imports */
// Original procedural contour artwork. Run from any directory with Node + Sharp.
// Equal elevation intervals from a smooth synthetic terrain, not random strokes.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const out = path.join(__dirname, 'landos-c4-terrain-layers');
function elevation(x, y) {
  const hill = (cx,cy,sx,sy,h) => h*Math.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2));
  return hill(88,0,235,260,1.5)+hill(820,962,285,240,1.4)
    +hill(1110,535,170,235,1.1)+hill(-90,660,195,200,.9)
    +.24*Math.sin((x*.65+y)/185)+.075*Math.sin(x/72+y/108);
}
function contours() {
  const result=[];
  const step=12, size=1032;
  for(let level=-.15;level<1.76;level+=.145) {
    const parts=[];
    for(let y=0;y<size;y+=step) for(let x=0;x<size;x+=step) {
      const pts=[[x,y],[x+step,y],[x+step,y+step],[x,y+step]];
      const vals=pts.map(([a,b])=>elevation(a,b));
      const hits=[];
      for(let i=0;i<4;i++) {
        const j=(i+1)%4;
        if((vals[i]<level)!==(vals[j]<level)) {
          const t=(level-vals[i])/(vals[j]-vals[i]);
          hits.push([pts[i][0]+t*(pts[j][0]-pts[i][0]),pts[i][1]+t*(pts[j][1]-pts[i][1])]);
        }
      }
      for(let i=0;i+1<hits.length;i+=2) parts.push(`M${hits[i].map(n=>n.toFixed(2)).join(' ')}L${hits[i+1].map(n=>n.toFixed(2)).join(' ')}`);
    }
    result.push(`<path d="${parts.join('')}"/>`);
  }
  return result.join('\n');
}
const plate='M500 102Q512 94 524 102L909 342Q923 350 909 359L524 598Q512 606 500 598L115 359Q101 350 115 342Z';
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<title>LandOS app icon — Terrain Layers</title>
<desc>Three translucent spatial planes, a lime asymmetric selected parcel and original equal-interval synthetic terrain contours.</desc>
<defs>
 <linearGradient id="bg" x2="0.8" y2="1"><stop stop-color="#1A2227"/><stop offset="1" stop-color="#11191E"/></linearGradient>
 <linearGradient id="contour" x2="1" y2="1"><stop stop-color="#C8D26A"/><stop offset=".52" stop-color="#728B59"/><stop offset="1" stop-color="#B3C865"/></linearGradient>
 <linearGradient id="top" x2="1" y2=".5"><stop stop-color="#B4C441" stop-opacity=".48"/><stop offset=".5" stop-color="#538C43" stop-opacity=".53"/><stop offset="1" stop-color="#276347" stop-opacity=".57"/></linearGradient>
 <linearGradient id="middle" x2=".8" y2="1"><stop stop-color="#719B68" stop-opacity=".32"/><stop offset="1" stop-color="#406F50" stop-opacity=".4"/></linearGradient>
 <linearGradient id="base" x2="1" y2="1"><stop stop-color="#536C76" stop-opacity=".23"/><stop offset="1" stop-color="#315C6B" stop-opacity=".4"/></linearGradient>
 <linearGradient id="active" x2=".9" y2="1"><stop stop-color="#D6FF31"/><stop offset="1" stop-color="#BAFF00"/></linearGradient>
 <filter id="shadow" x="-25%" y="-30%" width="150%" height="180%"><feDropShadow dy="29" stdDeviation="24" flood-color="#000" flood-opacity=".5"/></filter>
 <filter id="glow" x="-25%" y="-35%" width="150%" height="170%"><feGaussianBlur stdDeviation="12"/></filter>
 <clipPath id="icon"><rect width="1024" height="1024" rx="186"/></clipPath>
 <clipPath id="topClip"><path d="${plate}"/></clipPath>
 <clipPath id="midClip"><path d="${plate}" transform="translate(0 144)"/></clipPath>
 <clipPath id="botClip"><path d="${plate}" transform="translate(0 288)"/></clipPath>
 <g id="contours" fill="none" stroke="url(#contour)" stroke-width="2.15" stroke-linecap="round">${contours()}</g>
 <path id="plate" d="${plate}"/>
</defs>
<rect width="1024" height="1024" fill="#11191E"/>
<g clip-path="url(#icon)">
 <rect width="1024" height="1024" fill="url(#bg)"/>
 <use href="#contours" opacity=".44"/>
 <!-- Bottom blue-grey reference plane. -->
 <use href="#plate" transform="translate(0 288)" fill="url(#base)" stroke="#759CA7" stroke-opacity=".64" stroke-width="5.5" filter="url(#shadow)"/>
 <g clip-path="url(#botClip)" opacity=".15"><use href="#contours"/></g>
 <g clip-path="url(#botClip)" fill="none" stroke="#90A76A" stroke-width="2.3" opacity=".37">
  <path d="M183 700L379 634 550 672 697 581M379 634L302 820M550 672L585 894M697 581L683 751 862 796"/>
 </g>
 <!-- Middle green glass plane. -->
 <use href="#plate" transform="translate(0 144)" fill="url(#middle)" stroke="#95BC83" stroke-opacity=".7" stroke-width="5" filter="url(#shadow)"/>
 <g clip-path="url(#midClip)" opacity=".15"><use href="#contours"/></g>
 <g clip-path="url(#midClip)" fill="none" stroke="#AAC77F" stroke-width="2.4" opacity=".28">
  <path d="M118 495L299 514 447 439 628 529 824 441M299 514L388 613 345 692M628 529L655 711M447 439L512 350"/>
 </g>
 <!-- Top active plane and asymmetric parcel subdivision. -->
 <use href="#plate" fill="url(#top)" filter="url(#shadow)"/>
 <g clip-path="url(#topClip)">
  <path d="M108 350L289 238 512 378 332 490Z" fill="#D4D954" opacity=".23"/>
  <path d="M512 378L678 275Q683 271 690 276L708 288Q715 293 723 288L806 237 925 350 638 518Z" fill="#447D3C" opacity=".18"/>
  <use href="#contours" opacity=".10"/>
  <g fill="none" stroke="#C1DD62" stroke-width="3.7" opacity=".57" stroke-linejoin="round">
   <path d="M402 169L512 220 618 164M512 220L512 378 678 275Q683 271 690 276L708 288Q715 293 723 288L806 237"/>
  </g>
  <path d="M289 238L512 378 332 490" fill="none" stroke="#E0FF72" stroke-width="5.3"/>
 </g>
 <!-- Controlled optical glow, with sharp geometry drawn over it. -->
 <use href="#plate" fill="none" stroke="#D4FC34" stroke-width="10" opacity=".58" filter="url(#glow)"/>
 <path d="M332 490L512 378 578 420Q583 424 578 427L532 456 638 518 524 598Q512 606 500 598Z" fill="#CBFF13" opacity=".55" filter="url(#glow)"/>
 <path d="M332 490L512 378 578 420Q583 424 578 427L532 456 638 518 524 598Q512 606 500 598Z" fill="url(#active)" stroke="#D7FF48" stroke-width="2" stroke-linejoin="round"/>
 <use href="#plate" fill="none" stroke="#DFFF69" stroke-width="5.5"/>
</g>
</svg>`;
async function main(){
 fs.writeFileSync(out+'.svg',svg);
 for(const size of [1024,120,60,32]) await sharp(Buffer.from(svg),{density:144}).resize(size,size).png().toFile(out+'-'+size+'.png');
 console.log('C4 SVG and 1024/120/60/32 PNG previews generated.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
