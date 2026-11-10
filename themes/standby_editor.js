/* Standby 3D studio: pick a face from a live gallery, tweak a draft, preview it, then apply to the robot. */
(()=>{'use strict';
const SRC=document.currentScript&&document.currentScript.src;
const root=document.getElementById('sb-root');
if(!root)return;
const FACES=[
 ['Chữ nổi 3D','Giờ phút bằng khối 3D, đung đưa nhẹ, bóng đổ, chuỗi hạt giây.','Ý tưởng: LVGL watch UI'],
 ['Đồng hồ kim 3D','Viền kim loại, kim giờ/phút/giây nổi khối trên mặt số.','Cổ điển'],
 ['Hệ quỹ đạo','Mặt trời ở giữa, hành tinh giờ phút giây chạy trên quỹ đạo.','Thiên văn'],
 ['Địa cầu','Quả địa cầu chấm sáng xoay, vệ tinh bay quanh.','Thiên văn'],
 ['Đường hầm sao','Bay xuyên không gian sao, giờ nổi khối ở giữa.','Không gian'],
 ['Vòng hoạt động','Ba vòng cung giờ/phút/giây nổi khối kiểu thể thao.','Kiểu Activity'],
 ['Chronograph','Mặt kim có 3 mặt phụ: giây, ngày, phút.','Cơ khí'],
 ['LCD cổ điển','Màn hình LCD bảy đoạn kiểu đồng hồ điện tử, đoạn tắt mờ.','Retro'],
 ['Mưa số','Cột sáng rơi kiểu ma trận, giờ nổi khối phía trước.','Cyber'],
 ['Thời tiết','Nền đen, giờ xanh neon, biểu tượng thời tiết, nhiệt độ và 3 vòng cao/ẩm/thấp (theo mod DienBien).','Mod DienBien']];
const THEMES=[
 ['Ngọc lục bảo',{accent:'#4ade80',accent2:'#ff6fae',top:'#050b1c',bottom:'#1c2b5a'}],
 ['Hoàng hôn',{accent:'#ffb347',accent2:'#ff5e7e',top:'#2a0f3a',bottom:'#7a2b4f'}],
 ['Băng giá',{accent:'#7fdcff',accent2:'#ffffff',top:'#04101f',bottom:'#0f3a5c'}],
 ['Neon',{accent:'#ff2bd6',accent2:'#27f3ff',top:'#070014',bottom:'#220a45'}],
 ['Vàng kim',{accent:'#ffd24a',accent2:'#ff8a3d',top:'#0a0805',bottom:'#3a2a0c'}],
 ['Anh đào',{accent:'#ff8fb1',accent2:'#ffe0ea',top:'#1a0a14',bottom:'#4a1a34'}],
 ['Đại dương',{accent:'#2dd4bf',accent2:'#facc15',top:'#021a1f',bottom:'#0b4a55'}],
 ['Trắng tinh',{accent:'#1f2937',accent2:'#e11d48',top:'#e8eef7',bottom:'#b9c6da'}]];
const TOGGLES=[['date','Hiện ngày tháng'],['climate','Hiện nhiệt độ, độ ẩm'],['seconds','Hiện giây (kim giây, hạt giây, nháy dấu :)'],
 ['glossy','Vật liệu bóng (phản chiếu ánh sáng)'],['shadow','Bóng đổ dưới vật thể'],['cycle','Tự đổi mặt đồng hồ luân phiên'],['wall','Dùng ảnh nền đã tải lên']];
const SLIDERS=[['sway','Độ đung đưa camera',0,100,'%'],['speed','Tốc độ hiệu ứng',0,100,'%'],['size','Kích thước cảnh',60,120,'%'],
 ['fps','Khung hình/giây (cao = mượt, tốn CPU)',4,20,' fps'],['cycle_s','Thời gian mỗi mặt khi tự đổi',5,600,' giây'],['dim','Làm tối ảnh nền cho dễ đọc giờ',0,80,'%']];
const COLORS=[['accent','Màu chính'],['accent2','Màu nhấn (giây, điểm sáng)'],['top','Nền phía trên'],['bottom','Nền phía dưới']];
const KEYS=['face','accent','accent2','top','bottom','seconds','date','climate','glossy','shadow','cycle','cycle_s','sway','speed','fps','size','wall','dim','legacy'];
let wallFromUrl=null,packs=[];
let saved=null,draft=null,live=0,liveUntil=0,previewTimer=0,thumbTimer=0,queue=Promise.resolve();
const el=(tag,attrs={},...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='class')e.className=v;else if(k==='text')e.textContent=v;else e[k]=v;}e.append(...kids);return e;};
const status=el('p',{role:'status',class:'sb-status',text:'Đang tải…'});
const big=el('canvas',{class:'sb-preview',width:240,height:240,'aria-label':'Xem trước màn hình chờ'});
const gallery=el('div',{class:'sb-gallery'});
const themeBox=el('div',{class:'sb-themes'});
const colorBox=el('div',{class:'sb-grid'});
const toggleBox=el('div',{class:'sb-toggles'});
const sliderBox=el('div',{class:'sb-grid'});
const wallBox=el('div',{class:'sb-wall'});
const legacySel=el('select');
[['-1','Tắt: dùng mặt 3D ở trên'],['2','Robot Mini (bản cũ)'],['0','Shadow (bản cũ)']].forEach(([v,t])=>legacySel.append(new Option(t,v)));
legacySel.onchange=()=>change({legacy:Number(legacySel.value)});
const controls={};
const thumbs=[];
const apply=el('button',{type:'button',class:'sb-primary',text:'Áp dụng lên robot'});
const undo=el('button',{type:'button',text:'Hoàn tác'});
const liveBtn=el('button',{type:'button',text:'Xem trực tiếp 60 giây'});
const reset=el('button',{type:'button',class:'stop',text:'Mặc định'});

function drawBmp(canvas,buffer){
 const v=new DataView(buffer),off=v.getUint32(10,true),w=v.getInt32(18,true),hRaw=v.getInt32(22,true),h=Math.abs(hRaw);
 if(v.getUint16(28,true)!==16||w<=0||h<=0)throw Error('BMP không hỗ trợ');
 canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d'),img=ctx.createImageData(w,h);
 for(let y=0;y<h;++y){const sy=hRaw<0?y:h-1-y;for(let x=0;x<w;++x){const p=v.getUint16(off+(sy*w+x)*2,true),o=(y*w+x)*4;
  img.data[o]=((p>>11)&31)*255/31;img.data[o+1]=((p>>5)&63)*255/63;img.data[o+2]=(p&31)*255/31;img.data[o+3]=255;}}
 ctx.putImageData(img,0,0);
}
const payload=(extra={})=>{const o={};for(const k of KEYS)o[k]=draft[k];return JSON.stringify({...o,...extra});};
function render(half,face){
 // Renders are serialised: the robot draws one preview at a time.
 const run=async()=>{
  const body=payload({half:!!half,...(face===undefined?{}:{face})});
  const r=await fetch('/api/standby/preview',{method:'POST',headers:{'Content-Type':'application/json'},body,signal:AbortSignal.timeout(9000)});
  if(!r.ok)throw Error('Robot chưa tạo được ảnh');return r.arrayBuffer();
 };
 const p=queue.then(run,run);queue=p.catch(()=>{});return p;
}
let bigGen=0,thumbGen=0;
async function paintBig(){const g=++bigGen;try{const b=await render(false);if(g===bigGen)drawBmp(big,b);}catch{}}
async function paintThumbs(){
 const g=++thumbGen;
 for(let i=0;i<FACES.length;++i){
  if(g!==thumbGen)break;
  for(let attempt=0;attempt<2;++attempt){try{const b=await render(true,i);if(g===thumbGen)drawBmp(thumbs[i],b);break;}catch{await new Promise(r=>setTimeout(r,600));}}
 }
}
const dirty=()=>KEYS.some(k=>draft[k]!==saved[k]);
function paint(){
 gallery.querySelectorAll('.sb-card').forEach((b,i)=>{b.setAttribute('aria-pressed',String(i===draft.face));b.classList.toggle('sb-live',i===saved.face);});
 for(const [k] of COLORS)controls[k].value=draft[k];
 for(const [k] of TOGGLES)controls[k].checked=!!draft[k];
 for(const [k,,,,unit] of SLIDERS){controls[k].value=draft[k];controls[k+'_v'].textContent=draft[k]+unit;}
 legacySel.value=String(draft.legacy);if(legacySel.value!==String(draft.legacy)){legacySel.append(new Option('Kiểu cũ '+draft.legacy,String(draft.legacy)));legacySel.value=String(draft.legacy);}
 controls.cycle_s.closest('label').hidden=!draft.cycle;controls.dim.closest('label').hidden=!draft.wall;
 apply.disabled=!dirty();undo.disabled=!dirty();
 if(dirty())status.textContent='Có thay đổi chưa áp dụng — xem trước bên cạnh, bấm “Áp dụng lên robot” khi ưng ý.';
}
function change(patch,thumbsToo=true){
 Object.assign(draft,patch);paint();
 clearTimeout(previewTimer);previewTimer=setTimeout(paintBig,350);
 if(thumbsToo){clearTimeout(thumbTimer);thumbTimer=setTimeout(paintThumbs,1500);}
}
async function post(path,bodyObj){
 const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(bodyObj),signal:AbortSignal.timeout(9000)});
 const d=await r.json();if(!r.ok)throw Error(d.message||'Lỗi');return d;
}
apply.onclick=async()=>{
 apply.disabled=true;status.textContent='Đang áp dụng…';
 try{const o={};for(const k of KEYS)o[k]=draft[k];const d=await post('/api/standby',o);saved={...d};draft={...d};paint();status.textContent='Đã áp dụng lên robot.';}
 catch(e){status.textContent='Không áp dụng được: '+e.message;}paint();
};
undo.onclick=()=>{draft={...saved};paint();paintBig();paintThumbs();status.textContent='Đã hoàn tác về cấu hình đang dùng.';};
reset.onclick=async()=>{if(!confirm('Khôi phục toàn bộ cài đặt màn hình chờ về mặc định?'))return;
 try{const d=await post('/api/standby',{reset:true});saved={...d};draft={...d};paint();paintBig();paintThumbs();status.textContent='Đã khôi phục mặc định.';}catch(e){status.textContent='Không khôi phục được: '+e.message;}};
liveBtn.onclick=()=>{clearInterval(live);liveUntil=Date.now()+60000;live=setInterval(()=>{if(Date.now()>liveUntil||document.hidden){clearInterval(live);return;}paintBig();},1200);paintBig();};

FACES.forEach(([name,desc,tag],i)=>{
 const thumb=el('canvas',{width:120,height:120,class:'sb-thumb'});thumbs.push(thumb);
 const card=el('button',{type:'button',class:'sb-card'},thumb,el('b',{text:name}),el('small',{text:desc}),el('em',{text:tag}));
 card.onclick=()=>change({face:i},false);gallery.append(card);
});
for(const [name,colors] of THEMES){
 const b=el('button',{type:'button',class:'sb-theme',title:name},el('i'),el('span',{text:name}));
 b.style.setProperty('background','linear-gradient(135deg,'+colors.top+','+colors.bottom+')','important');b.firstChild.style.background=colors.accent;
 b.onclick=()=>change(colors);themeBox.append(b);
}
for(const [k,label] of COLORS){
 const input=el('input',{type:'color'});controls[k]=input;input.oninput=()=>change({[k]:input.value});colorBox.append(el('label',{},label,input));
}
for(const [k,label] of TOGGLES){
 const input=el('input',{type:'checkbox'});controls[k]=input;input.onchange=()=>change({[k]:input.checked});
 toggleBox.append(el('label',{class:'hy-check'},input,label));
}
for(const [k,label,min,max,unit] of SLIDERS){
 const input=el('input',{type:'range',min,max,step:1}),out=el('output');controls[k]=input;controls[k+'_v']=out;
 input.oninput=()=>{out.textContent=input.value+unit;change({[k]:Number(input.value)},k==='dim');};
 sliderBox.append(el('label',{},label+' ',out,input));
}
/* Wallpaper upload (crop to 240x240, native RGB565, stored in its own flash area). */
{
 const file=el('input',{type:'file',accept:'image/png,image/jpeg,image/webp'});
 const thumb=el('canvas',{width:120,height:120,class:'sb-wallthumb'});
 const save=el('button',{type:'button',text:'Lưu ảnh nền lên robot',disabled:true}),del=el('button',{type:'button',class:'stop',text:'Xóa ảnh nền'});
 const note=el('p',{class:'sb-status',text:'Chọn ảnh PNG/JPG/WebP (tối đa 8 MB). Ảnh được cắt vuông 240 × 240. Sau khi lưu, ảnh nền tự được bật.'});
 let prepared=null,revision=0;
 file.onchange=async()=>{
  const current=++revision;prepared=null;save.disabled=true;const f=file.files[0];if(!f)return;
  if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>8*1024*1024){note.textContent='Chọn PNG/JPG/WebP dưới 8 MB.';return;}
  let bitmap;
  try{
   bitmap=await createImageBitmap(f);
   const c=document.createElement('canvas');c.width=c.height=240;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingQuality='high';ctx.fillStyle='#000';ctx.fillRect(0,0,240,240);
   const side=Math.min(bitmap.width,bitmap.height);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,240,240);
   if(!globalThis.hynhiEncode565)throw Error('Thiếu bộ mã hóa ảnh');
   const blob=globalThis.hynhiEncode565(ctx.getImageData(0,0,240,240).data,180224);if(current!==revision)return;
   prepared=blob;thumb.getContext('2d').drawImage(c,0,0,120,120);save.disabled=false;note.textContent='Ảnh xem trước · '+(blob.size/1024).toFixed(1)+' KB · chưa lưu.';
  }catch(e){note.textContent=e.message||'Không đọc được ảnh';}finally{if(bitmap)bitmap.close();}
 };
 async function send(method){
  file.disabled=save.disabled=del.disabled=true;
  try{
   const r=await fetch('/api/clock/wallpaper',{method,body:method==='POST'?prepared:undefined,headers:method==='POST'?{'Content-Type':'application/octet-stream'}:{},signal:AbortSignal.timeout(20000)});
   const d=await r.json();if(!r.ok||!d.ok)throw Error(d.message||'Chưa lưu được');
   note.textContent=d.message||'Đã lưu.';
   if(method==='POST'){draft.wall=true;saved.wall=true;await post('/api/standby',{wall:true});}else{draft.wall=false;saved.wall=false;await post('/api/standby',{wall:false});}
   paint();paintBig();paintThumbs();
  }catch(e){note.textContent='Chưa nhận xác nhận: '+e.message;}finally{file.disabled=del.disabled=false;save.disabled=!prepared;}
 }
 save.onclick=()=>prepared&&send('POST');del.onclick=()=>send('DELETE');
 wallFromUrl=async url=>{const r=await fetch(url);if(!r.ok)throw Error('HTTP '+r.status);const bitmap=await createImageBitmap(await r.blob());try{const c=document.createElement('canvas');c.width=c.height=240;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#000';ctx.fillRect(0,0,240,240);const side=Math.min(bitmap.width,bitmap.height);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,240,240);prepared=globalThis.hynhiEncode565(ctx.getImageData(0,0,240,240).data,180224);thumb.getContext('2d').drawImage(c,0,0,120,120);}finally{bitmap.close();}await send('POST');};
 wallBox.append(thumb,el('div',{class:'sb-wallside'},file,el('div',{class:'row'},save,del),note));
 fetch('/api/clock/wallpaper').then(r=>r.ok?r.blob():null).then(async b=>{if(!b)return;const bmp=await createImageBitmap(b);thumb.getContext('2d').drawImage(bmp,0,0,120,120);bmp.close();}).catch(()=>{});
}
function packButtons(){
 themeBox.replaceChildren();
 const list=packs.length?packs:THEMES.map(([name,config])=>({name,config}));
 for(const pack of list){
  const c=pack.config||{};
  const b=el('button',{type:'button',class:'sb-theme',title:pack.description||pack.name},el('i'),el('span',{text:pack.name}));
  b.style.setProperty('background','linear-gradient(135deg,'+(c.top||'#050b1c')+','+(c.bottom||'#1c2b5a')+')','important');b.firstChild.style.background=c.accent||'#4ade80';
  b.onclick=async()=>{
   change(c);
   if(pack.wallpaper&&wallFromUrl){status.textContent='Đang nạp ảnh nền của gói…';try{await wallFromUrl(new URL(pack.wallpaper,SRC||location.href).href);}catch(e){status.textContent='Không nạp được ảnh nền: '+e.message;}}
  };
  themeBox.append(b);
 }
}
const section=(title,note,...kids)=>el('div',{class:'sb-section'},el('h3',{text:title}),note?el('p',{class:'sb-note',text:note}):'',...kids);
root.append(
 el('div',{class:'sb-top'},big,el('div',{class:'sb-top-side'},
  el('p',{class:'sb-lead',text:'Màn hình chờ vẽ 3D thật bằng bộ raster phần mềm ngay trên robot. Chọn mặt, chỉnh màu và tùy chọn: ảnh bên cạnh là bản xem trước do chính robot vẽ. Chỉ khi bấm “Áp dụng lên robot” thì màn hình mới đổi.'}),
  el('div',{class:'row'},apply,undo),el('div',{class:'row'},liveBtn,reset),status)),
 section('Bản đồng hồ cũ','Khôi phục mặt đồng hồ LVGL trước đây (Robot Mini có nhân vật robot nhỏ). Khi bật, các mặt 3D bên dưới tạm không dùng.',el('label',{},'Kiểu',legacySel)),
 section('Chọn mặt đồng hồ','Ảnh nhỏ dưới đây là bản xem trước từng mặt với màu và tùy chọn hiện tại của bạn.',gallery),
 section('Bộ màu có sẵn','',themeBox),section('Màu tùy chỉnh','',colorBox),
 section('Ảnh nền','Thay nền gradient bằng ảnh của bạn.',wallBox),
 section('Tùy chọn','',toggleBox,sliderBox));
if(SRC)fetch(new URL('index.json',SRC).href,{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(c=>{if(c&&Array.isArray(c.packs)){packs=c.packs;packButtons();}}).catch(()=>{});
packButtons();
fetch('/api/standby',{cache:'no-store'}).then(r=>r.json()).then(d=>{saved={...d};draft={...d};paint();status.textContent='Sẵn sàng.';paintBig().then(paintThumbs);})
 .catch(()=>{status.textContent='Không đọc được cấu hình màn hình chờ.';});
})();
