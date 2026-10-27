import React, { useId, useMemo, useState } from "react";
import { packingNumber as n } from "./carton-packing-model.mjs";
export const packingColors = ["#287b64", "#97722a", "#517b9b", "#a26455", "#75648c", "#647a45"];

export default function PackingScene({ plan, interactive = true }) {
  const [yaw, setYaw] = useState(35), [layer, setLayer] = useState("all"), [sku, setSku] = useState("all");
  const id = useId(), angle = yaw * Math.PI / 180, tilt = 28 * Math.PI / 180;
  const project = ([x, y, z]) => [x * Math.cos(angle) - z * Math.sin(angle), (x * Math.sin(angle) + z * Math.cos(angle)) * Math.sin(tilt) - y * Math.cos(tilt)];
  const layers = [...new Set(plan.placements.map(p => p.position[1]))].sort((a, b) => a - b);
  const visibleCount = plan.placements.filter(p => layer === "all" || p.position[1] === Number(layer)).length;
  const corners = ([x, y, z], [l, h, w]) => [[x,y,z],[x+l,y,z],[x+l,y,z+w],[x,y,z+w],[x,y+h,z],[x+l,y+h,z],[x+l,y+h,z+w],[x,y+h,z+w]];
  const box = corners([0,0,0], plan.bin), boundary = box.map(project);
  const minX = Math.min(...boundary.map(p=>p[0])), maxX = Math.max(...boundary.map(p=>p[0])), minY = Math.min(...boundary.map(p=>p[1])), maxY = Math.max(...boundary.map(p=>p[1]));
  const scale = Math.min(570 / (maxX-minX), 315 / (maxY-minY));
  const screen = v => { const [x,y]=project(v); return [65+(x-minX)*scale,45+(y-minY)*scale]; };
  const points = vertices => vertices.map(v=>screen(v).join(",")).join(" ");
  const faces = useMemo(() => plan.placements.filter(p=>layer==="all"||p.position[1]===Number(layer)).flatMap((p,index)=>{
    const v=corners(p.position,p.dimension);
    return [[4,5,6,7],[1,2,6,5],[2,3,7,6]].map((indices,face)=>({ vertices:indices.map(i=>v[i]), sku:p.sku, index, face, depth:indices.reduce((s,i)=>s+v[i][0]*Math.sin(angle)+v[i][2]*Math.cos(angle)+v[i][1]*Math.tan(tilt),0)/4 }));
  }).sort((a,b)=>a.depth-b.depth),[plan,yaw,layer]);
  const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  return <figure className="packing-scene">
    {interactive && <div className="packing-view-controls"><label htmlFor={id+"-angle"}>View angle<input id={id+"-angle"} type="range" min="10" max="80" value={yaw} onChange={e=>setYaw(Number(e.target.value))}/></label><label htmlFor={id+"-layer"}>Show layer<select id={id+"-layer"} value={layer} onChange={e=>setLayer(e.target.value)}><option value="all">All layers</option>{layers.map(h=><option key={h} value={h}>Bottom at {n(h)} mm</option>)}</select></label><label htmlFor={id+"-sku"}>Highlight<select id={id+"-sku"} value={sku} onChange={e=>setSku(e.target.value)}><option value="all">All SKUs</option>{plan.items.map((r,i)=><option key={i} value={i}>{r.name}</option>)}</select></label></div>}
    <svg viewBox="0 0 700 420" role="img" aria-label={`Rectangular packing visualization: ${n(plan.packed)} planned units, ${visibleCount} currently visible. Usable carton ${plan.bin[0]} by ${plan.bin[2]} by ${plan.bin[1]} millimetres.`}>
      <polygon points={points(box.slice(0,4))} fill="#edf3ee" stroke="#c4d3c8"/>
      {edges.map(([a,b],i)=><line key={i} x1={screen(box[a])[0]} y1={screen(box[a])[1]} x2={screen(box[b])[0]} y2={screen(box[b])[1]} stroke="#9cafaa" strokeWidth="1" strokeDasharray="4 4"/>)}
      {faces.map((f,i)=><g key={i} opacity={sku==="all"||f.sku===Number(sku)?1:.18}><polygon points={points(f.vertices)} fill={packingColors[f.sku]} stroke="#fff" strokeWidth=".8"/><polygon points={points(f.vertices)} fill={f.face===0?"#fff":"#000"} opacity={f.face===0?.18:f.face===1?.07:.19}/></g>)}
      <text x="55" y="395" fill="#36574a" fontSize="14">L {n(plan.bin[0])} × W {n(plan.bin[2])} × H {n(plan.bin[1])} mm · usable inside</text>
    </svg>
    {!interactive && <div className="packing-scene-legend">{plan.items.map((r,i)=><span key={i}><i style={{background:packingColors[i]}}/>SKU {i+1}: {r.name} ({n(r.packed)})</span>)}</div>}
    <figcaption>{plan.visualTruncated ? `Drawing limited to the first ${plan.placements.length} of ${n(plan.packed)} units; calculations use the full grid.` : "Rectangular outer envelopes. Actual package shape and load support need review."}{interactive&&" View controls change this screen only; the PDF uses an unfiltered plan view."}</figcaption>
  </figure>;
}
