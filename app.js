
const state={cal:[],pred:[],proc:null,pls:null,model:null};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const colors=['#2563eb','#dc2626','#059669','#7c3aed','#d97706','#0891b2','#be185d','#4d7c0f','#9333ea','#0f766e','#ea580c','#475569'];

function showTab(name){
  $$('.tab').forEach(x=>x.classList.remove('active'));
  $$('nav button').forEach(x=>x.classList.remove('active'));
  $('#tab-'+name).classList.add('active');
  document.querySelector(`nav button[data-tab="${name}"]`).classList.add('active');
}
$$('nav button').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));

function parseGenesys(text,name){
  const wl=[],abs=[];
  for(const line of text.split(/\r?\n/)){
    const m=line.match(/^\s*(\d{3})\s+(\[\*+\]|[-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?)/);
    if(!m) continue;
    wl.push(Number(m[1]));
    abs.push(m[2].includes('*')?NaN:Number(m[2]));
  }
  if(!wl.length) throw new Error(`Nenhum dado espectral encontrado em ${name}`);
  return {name,wl,abs,ppm:null};
}

async function readFiles(fileList){
  const out=[];
  for(const f of [...fileList]){
    const txt=await f.text();
    out.push(parseGenesys(txt,f.name));
  }
  return out;
}

function sameAxis(samples){
  if(!samples.length) return true;
  const a=samples[0].wl;
  return samples.every(s=>s.wl.length===a.length && s.wl.every((v,i)=>v===a[i]));
}

function renderSampleTable(){
  const tb=$('#sampleTable tbody'); tb.innerHTML='';
  state.cal.forEach((s,i)=>{
    const tr=document.createElement('tr');
    const valid=s.abs.filter(Number.isFinite).length;
    tr.innerHTML=`<td>${esc(s.name)}</td>
      <td><input class="ppm" type="number" step="any" value="${s.ppm??''}" data-i="${i}" style="width:90px"></td>
      <td>${valid}</td><td>${s.abs.length-valid}</td>
      <td><button class="smallbtn" data-del="${i}">Remover</button></td>`;
    tb.appendChild(tr);
  });
  $$('.ppm').forEach(inp=>inp.addEventListener('input',e=>{
    const v=e.target.value.trim();
    state.cal[+e.target.dataset.i].ppm=v===''?null:Number(v);
  }));
  $$('[data-del]').forEach(b=>b.addEventListener('click',()=>{
    state.cal.splice(+b.dataset.del,1); renderSampleTable(); updateDataSummary(); drawRaw();
  }));
}
function updateDataSummary(){
  const n=state.cal.length;
  const ppm=state.cal.filter(s=>Number.isFinite(s.ppm)).length;
  const points=n?state.cal[0].wl.length:0;
  const valid=n?state.cal[0].wl.filter((_,j)=>state.cal.every(s=>Number.isFinite(s.abs[j]))).length:0;
  $('#dataSummary').innerHTML=[
    ['Amostras',n],['Com ppm',ppm],['Pontos/espectro',points],['Variáveis comuns',valid]
  ].map(([a,b])=>`<div class="metric">${a}<b>${b}</b></div>`).join('');
}

$('#calFiles').addEventListener('change',async e=>{
  try{
    const arr=await readFiles(e.target.files);
    if(state.cal.length && !sameAxis([...state.cal,...arr])) throw new Error('Eixos de wavelength diferentes.');
    state.cal.push(...arr);
    renderSampleTable(); updateDataSummary(); drawRaw();
    if(state.cal.length){$('#lambdaMin').value=state.cal[0].wl[0];$('#lambdaMax').value=state.cal[0].wl.at(-1);}
  }catch(err){alert(err.message);}
});
$('#clearCal').addEventListener('click',()=>{state.cal=[];state.proc=null;state.pls=null;state.model=null;renderSampleTable();updateDataSummary();clearCanvas('#rawChart');});
$('#exampleBtn').addEventListener('click',()=>alert('Use seus arquivos TXT do GENESYS. A concentração em ppm é informada na tabela após a importação.'));

function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function clearCanvas(sel){const c=$(sel),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);}
function drawLineChart(canvas,x,series,xlab,ylab,title){
  const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;
  ctx.clearRect(0,0,W,H); ctx.fillStyle='white';ctx.fillRect(0,0,W,H);
  const pad={l:65,r:20,t:35,b:50};
  const vals=series.flatMap(s=>s.y.filter(Number.isFinite));
  if(!x.length||!vals.length){ctx.fillStyle='#667085';ctx.fillText('Sem dados',20,30);return;}
  const xmin=Math.min(...x),xmax=Math.max(...x),ymin=Math.min(...vals),ymax=Math.max(...vals);
  const xr=xmax-xmin||1, yr=ymax-ymin||1;
  const sx=v=>pad.l+(v-xmin)/xr*(W-pad.l-pad.r), sy=v=>H-pad.b-(v-ymin)/yr*(H-pad.t-pad.b);
  ctx.strokeStyle='#cfd4dc';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.l,pad.t);ctx.lineTo(pad.l,H-pad.b);ctx.lineTo(W-pad.r,H-pad.b);ctx.stroke();
  ctx.font='12px Arial';ctx.fillStyle='#4b5563';
  for(let k=0;k<=5;k++){
    const xv=xmin+xr*k/5;ctx.fillText(xv.toFixed(0),sx(xv)-10,H-pad.b+20);
    const yv=ymin+yr*k/5;ctx.fillText(yv.toFixed(3),5,sy(yv)+4);
  }
  series.forEach((s,si)=>{
    ctx.strokeStyle=s.color||colors[si%colors.length];ctx.lineWidth=1.5;ctx.beginPath();let started=false;
    s.y.forEach((v,i)=>{if(!Number.isFinite(v)) {started=false;return;} const X=sx(x[i]),Y=sy(v);if(!started){ctx.moveTo(X,Y);started=true}else ctx.lineTo(X,Y);});
    ctx.stroke();
  });
  ctx.fillStyle='#111827';ctx.font='bold 15px Arial';ctx.fillText(title,pad.l,20);
  ctx.font='12px Arial';ctx.fillText(xlab,W/2-40,H-10);
  ctx.save();ctx.translate(15,H/2+30);ctx.rotate(-Math.PI/2);ctx.fillText(ylab,0,0);ctx.restore();
}
function drawRaw(){
  if(!state.cal.length)return;
  drawLineChart($('#rawChart'),state.cal[0].wl,state.cal.map((s,i)=>({y:s.abs,color:colors[i%colors.length]})),'Wavelength (nm)','Absorbance','Espectros UV brutos');
  $('#spectraLegend').innerHTML=state.cal.map((s,i)=>`<span><i style="background:${colors[i%colors.length]}"></i>${esc(s.name)}</span>`).join('');
}

function preprocessFit(X,method){
  const n=X.length,p=X[0].length,pp={method};
  if(method==='none')return {X:X.map(r=>r.slice()),pp};
  if(method==='mc'){
    const mean=Array.from({length:p},(_,j)=>avg(X.map(r=>r[j])));pp.mean=mean;
    return {X:X.map(r=>r.map((v,j)=>v-mean[j])),pp};
  }
  if(method==='snv'){
    return {X:X.map(r=>{const m=avg(r),s=std(r)||1;return r.map(v=>(v-m)/s)}),pp};
  }
  if(method==='norm'){
    return {X:X.map(r=>{const norm=Math.sqrt(r.reduce((a,v)=>a+v*v,0))||1;return r.map(v=>v/norm)}),pp};
  }
  if(method==='sg1'||method==='sg2'){
    const order=method==='sg1'?1:2;
    return {X:X.map(r=>simpleDerivative(r,order)),pp:{method,order}};
  }
  throw new Error('Pré-processamento desconhecido.');
}
function preprocessApply(X,pp){
  if(pp.method==='none')return X.map(r=>r.slice());
  if(pp.method==='mc')return X.map(r=>r.map((v,j)=>v-pp.mean[j]));
  if(pp.method==='snv')return X.map(r=>{const m=avg(r),s=std(r)||1;return r.map(v=>(v-m)/s)});
  if(pp.method==='norm')return X.map(r=>{const norm=Math.sqrt(r.reduce((a,v)=>a+v*v,0))||1;return r.map(v=>v/norm)});
  if(pp.method==='sg1'||pp.method==='sg2')return X.map(r=>simpleDerivative(r,pp.order));
  return X;
}
function simpleDerivative(r,order){
  let d=r.map((v,i)=>i===0?r[1]-r[0]:i===r.length-1?r.at(-1)-r.at(-2):(r[i+1]-r[i-1])/2);
  if(order===1)return d;
  return d.map((v,i)=>i===0?d[1]-d[0]:i===d.length-1?d.at(-1)-d.at(-2):(d[i+1]-d[i-1])/2);
}

$('#applyPre').addEventListener('click',()=>{
  if(!state.cal.length)return alert('Importe amostras primeiro.');
  if(!sameAxis(state.cal))return alert('Eixos espectrais diferentes.');
  const wl=state.cal[0].wl;
  const common=wl.map((_,j)=>state.cal.every(s=>Number.isFinite(s.abs[j])));
  const lmin=Number($('#lambdaMin').value),lmax=Number($('#lambdaMax').value);
  const idx=wl.map((v,j)=>common[j]&&v>=lmin&&v<=lmax);
  const keep=idx.map((v,i)=>v?i:-1).filter(i=>i>=0);
  if(!keep.length)return alert('Nenhuma variável válida na faixa selecionada.');
  const Xraw=state.cal.map(s=>keep.map(j=>s.abs[j])), wlc=keep.map(j=>wl[j]);
  const {X,pp}=preprocessFit(Xraw,$('#preMethod').value);
  state.proc={X,Xraw,wl:wlc,pp,method:pp.method};
  $('#preInfo').textContent=`${wlc.length} variáveis válidas | faixa ${wlc[0]}–${wlc.at(-1)} nm | método ${pp.method}`;
  drawLineChart($('#preChart'),wlc,X.map((r,i)=>({y:r,color:colors[i%colors.length]})),'Wavelength (nm)','Sinal processado','Espectros pré-processados');
});

$('#runPCA').addEventListener('click',()=>{
  if(!state.proc)return alert('Aplique o tratamento UV primeiro.');
  const res=pca2(state.proc.X);
  drawScatter($('#pcaScoreChart'),res.scores.map(r=>r[0]),res.scores.map(r=>r[1]),state.cal.map(s=>s.name),'PC1','PC2','PCA Scores');
  drawBars($('#pcaVarChart'),['PC1','PC2'],res.explained,'Variância explicada (%)');
  $('#pcaInfo').textContent=`PC1: ${res.explained[0].toFixed(2)}% | PC2: ${res.explained[1].toFixed(2)}%`;
});

$('#runPLS').addEventListener('click',()=>{
  if(!state.proc)return alert('Aplique o tratamento UV primeiro.');
  const rows=state.cal.map((s,i)=>({i,y:s.ppm})).filter(o=>Number.isFinite(o.y));
  if(rows.length<3)return alert('Informe concentração ppm para pelo menos 3 amostras de calibração.');
  const X=rows.map(o=>state.proc.X[o.i]), y=rows.map(o=>o.y), names=rows.map(o=>state.cal[o.i].name);
  const maxLV=Math.max(1,Math.min(Number($('#maxLV').value)||1, X.length-1, X[0].length));
  const method=$('#cvMethod').value, k=Number($('#kFolds').value)||5;
  const cv=plsCrossValidate(X,y,maxLV,method,k);
  const best=argmin(cv.rmse)+1;
  const mdl=plsFit(X,y,best);
  const yhat=plsPredict(mdl,X);
  const vip=vipScores(mdl,X,y);
  const metrics=calcMetrics(y,yhat,cv.ycv[best-1]);
  state.pls={X,y,names,cv,best,mdl,yhat,vip,metrics};
  state.model={
    version:'1.0',created:new Date().toISOString(),
    wl:state.proc.wl,preprocess:state.proc.pp,
    pls:mdl,nLV:best,calibration:{names,y},
    metrics
  };
  drawLineChart($('#rmseChart'),Array.from({length:maxLV},(_,i)=>i+1),[{y:cv.rmse,color:'#2563eb'}],'Latent variables','RMSECV','Seleção de LV');
  drawScatter($('#predChart'),y,cv.ycv[best-1],names,'Measured TOG','CV predicted TOG','Medido × previsto (CV)',true);
  $('#plsMetrics').innerHTML=[
    ['LV',best],['RMSEC',metrics.rmsec.toFixed(4)],['RMSECV',metrics.rmsecv.toFixed(4)],
    ['R² cal',metrics.r2cal.toFixed(4)],['R² CV',metrics.r2cv.toFixed(4)],['Bias CV',metrics.biascv.toFixed(4)]
  ].map(([a,b])=>`<div class="metric">${a}<b>${b}</b></div>`).join('');
  renderValidation(); renderModelSummary();
});

function renderValidation(){
  if(!state.pls)return;
  const {y,names,yhat,cv,best,vip}=state.pls, ycv=cv.ycv[best-1];
  drawResidual($('#residChart'),ycv.map((v,i)=>y[i]-v),names);
  drawVIP($('#vipChart'),state.proc.wl,vip);
  $('#validationTableWrap').innerHTML=`<table><thead><tr><th>Amostra</th><th>Medido</th><th>Previsto cal</th><th>Previsto CV</th><th>Resíduo CV</th></tr></thead><tbody>`+
    names.map((n,i)=>`<tr><td>${esc(n)}</td><td>${y[i].toFixed(4)}</td><td>${yhat[i].toFixed(4)}</td><td>${ycv[i].toFixed(4)}</td><td>${(y[i]-ycv[i]).toFixed(4)}</td></tr>`).join('')+`</tbody></table>`;
}

function renderModelSummary(){
  if(!state.model){$('#modelSummary').textContent='Nenhum modelo criado/carregado.';return;}
  const m=state.model;
  $('#modelSummary').textContent=JSON.stringify({
    version:m.version,created:m.created,range:[m.wl[0],m.wl.at(-1)],
    variables:m.wl.length,preprocessing:m.preprocess.method,nLV:m.nLV,metrics:m.metrics
  },null,2);
}
$('#downloadModel').addEventListener('click',()=>{
  if(!state.model)return alert('Crie um modelo primeiro.');
  downloadText('UV_TOG_Model.json',JSON.stringify(state.model,null,2),'application/json');
});
$('#loadModelFile').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;
  try{state.model=JSON.parse(await f.text());renderModelSummary();alert('Modelo carregado.');}catch(err){alert('Modelo inválido.');}
});

$('#predFiles').addEventListener('change',async e=>{
  try{state.pred=await readFiles(e.target.files);renderPredTable();}catch(err){alert(err.message);}
});
function renderPredTable(results){
  const tb=$('#predTable tbody');tb.innerHTML='';
  state.pred.forEach((s,i)=>{
    const r=results?.[i];
    tb.insertAdjacentHTML('beforeend',`<tr><td>${esc(s.name)}</td><td>${r?Number(r.yhat).toFixed(4):'—'}</td><td>${r?esc(r.status):'Aguardando'}</td></tr>`);
  });
}
$('#runPredict').addEventListener('click',()=>{
  if(!state.model)return alert('Crie ou carregue um modelo.');
  if(!state.pred.length)return alert('Importe novas amostras.');
  const m=state.model,results=[];
  for(const s of state.pred){
    const aligned=m.wl.map(w=>{const i=s.wl.indexOf(w);return i>=0?s.abs[i]:NaN});
    if(aligned.some(v=>!Number.isFinite(v))){results.push({yhat:NaN,status:'Incompatível/NaN'});continue;}
    const Xpp=preprocessApply([aligned],m.preprocess);
    const yhat=plsPredict(m.pls,Xpp)[0];
    const status=inCalibrationDomain(Xpp[0],m.pls)?'OK':'Extrapolação';
    results.push({yhat,status});
  }
  state.predResults=results;
  renderPredTable(results);
  drawBars($('#predBarChart'),state.pred.map(s=>s.name),results.map(r=>Number.isFinite(r.yhat)?r.yhat:0),'TOG previsto (ppm)');
});

function inCalibrationDomain(x,mdl){
  const d=Math.sqrt(x.reduce((a,v,j)=>a+(v-mdl.mx[j])**2,0));
  return d <= (mdl.maxTrainDistance||Infinity)*1.15;
}

$('#exportCalCSV').addEventListener('click',()=>{
  const rows=['Sample,ppm',...state.cal.map(s=>`${csv(s.name)},${s.ppm??''}`)];
  downloadText('calibration_samples.csv',rows.join('\n'),'text/csv');
});
$('#exportPredCSV').addEventListener('click',()=>{
  if(!state.predResults)return alert('Execute as previsões.');
  const rows=['Sample,Predicted_TOG_ppm,Status',...state.pred.map((s,i)=>`${csv(s.name)},${state.predResults[i].yhat},${state.predResults[i].status}`)];
  downloadText('TOG_predictions.csv',rows.join('\n'),'text/csv');
});
$('#exportMetricsCSV').addEventListener('click',()=>{
  if(!state.pls)return alert('Gere o PLS.');
  const m=state.pls.metrics,rows=['Metric,Value',...Object.entries(m).map(([k,v])=>`${k},${v}`)];
  downloadText('PLS_metrics.csv',rows.join('\n'),'text/csv');
});

function downloadText(name,text,type){
  const blob=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
}
function csv(s){return `"${String(s).replaceAll('"','""')}"`;}

// ---------- Math ----------
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
const std=a=>{const m=avg(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/Math.max(1,a.length-1));};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const transpose=A=>A[0].map((_,j)=>A.map(r=>r[j]));
const matVec=(A,v)=>A.map(r=>dot(r,v));
const argmin=a=>a.reduce((bi,v,i)=>v<a[bi]?i:bi,0);
function center(X){const p=X[0].length,mean=Array.from({length:p},(_,j)=>avg(X.map(r=>r[j])));return {X:X.map(r=>r.map((v,j)=>v-mean[j])),mean};}

function plsFit(X,y,nLV){
  const n=X.length,p=X[0].length; const cx=center(X),mx=cx.mean,my=avg(y);
  let E=cx.X.map(r=>r.slice()), f=y.map(v=>v-my);
  const W=[],P=[],Q=[],T=[];
  for(let a=0;a<nLV;a++){
    let w=Array(p).fill(0);
    for(let j=0;j<p;j++)for(let i=0;i<n;i++)w[j]+=E[i][j]*f[i];
    const nw=Math.sqrt(dot(w,w)); if(nw<1e-12)break; w=w.map(v=>v/nw);
    const t=matVec(E,w),den=dot(t,t); if(den<1e-12)break;
    const pp=Array(p).fill(0);
    for(let j=0;j<p;j++)for(let i=0;i<n;i++)pp[j]+=E[i][j]*t[i]/den;
    const q=dot(f,t)/den;
    for(let i=0;i<n;i++){for(let j=0;j<p;j++)E[i][j]-=t[i]*pp[j];f[i]-=t[i]*q;}
    W.push(w);P.push(pp);Q.push(q);T.push(t);
  }
  const WT=transpose(W),PT=transpose(P); // p x A
  const M=matMul(transpose(PT),WT); // A x A = P'W
  const rhs=Q.slice();
  const sol=solve(M,rhs);
  const B=matVec(WT,sol); // p
  const b0=my-dot(mx,B);
  const dists=X.map(r=>Math.sqrt(r.reduce((s,v,j)=>s+(v-mx[j])**2,0)));
  return {B,b0,mx,my,W:WT,P:PT,Q,T:transpose(T),nLV:W.length,maxTrainDistance:Math.max(...dists)};
}
function plsPredict(m,X){return X.map(r=>m.b0+dot(r,m.B));}
function matMul(A,B){const Bt=transpose(B);return A.map(r=>Bt.map(c=>dot(r,c)));}
function solve(A,b){
  A=A.map((r,i)=>[...r,b[i]]);const n=A.length;
  for(let i=0;i<n;i++){let k=i;for(let j=i+1;j<n;j++)if(Math.abs(A[j][i])>Math.abs(A[k][i]))k=j;[A[i],A[k]]=[A[k],A[i]];
    let piv=A[i][i];if(Math.abs(piv)<1e-12)piv=1e-12;for(let j=i;j<=n;j++)A[i][j]/=piv;
    for(let r=0;r<n;r++)if(r!==i){const f=A[r][i];for(let j=i;j<=n;j++)A[r][j]-=f*A[i][j];}}
  return A.map(r=>r[n]);
}
function plsCrossValidate(X,y,maxLV,method,k){
  const n=X.length,rmse=[],ycv=[];
  for(let lv=1;lv<=maxLV;lv++){
    const yp=Array(n).fill(NaN);
    const folds=method==='loo'?Array.from({length:n},(_,i)=>[i]):makeFolds(n,Math.min(k,n));
    for(const test of folds){
      const testSet=new Set(test),train=Array.from({length:n},(_,i)=>i).filter(i=>!testSet.has(i));
      if(train.length<2)continue;
      const m=plsFit(train.map(i=>X[i]),train.map(i=>y[i]),Math.min(lv,train.length-1));
      test.forEach(i=>yp[i]=plsPredict(m,[X[i]])[0]);
    }
    ycv.push(yp);rmse.push(Math.sqrt(avg(y.map((v,i)=>(v-yp[i])**2))));
  }
  return {rmse,ycv};
}
function makeFolds(n,k){const folds=Array.from({length:k},()=>[]);for(let i=0;i<n;i++)folds[i%k].push(i);return folds;}
function calcMetrics(y,yhat,ycv){
  const rmsec=Math.sqrt(avg(y.map((v,i)=>(v-yhat[i])**2))),rmsecv=Math.sqrt(avg(y.map((v,i)=>(v-ycv[i])**2)));
  const ym=avg(y),sst=y.reduce((s,v)=>s+(v-ym)**2,0);
  const r2cal=1-y.reduce((s,v,i)=>s+(v-yhat[i])**2,0)/sst;
  const r2cv=1-y.reduce((s,v,i)=>s+(v-ycv[i])**2,0)/sst;
  const biascv=avg(ycv.map((v,i)=>v-y[i]));
  const mae=avg(ycv.map((v,i)=>Math.abs(v-y[i])));
  return {rmsec,rmsecv,r2cal,r2cv,biascv,mae};
}
function vipScores(m,X,y){
  const A=m.nLV,p=X[0].length;if(!A)return Array(p).fill(0);
  const T=m.T,W=m.W,Q=m.Q;
  const ssy=Array(A).fill(0).map((_,a)=>T[a].reduce((s,v)=>s+v*v,0)*(Q[a]**2));
  const total=ssy.reduce((a,b)=>a+b,0)||1;
  return Array.from({length:p},(_,j)=>Math.sqrt(p*ssy.reduce((s,ss,a)=>s+ss*(W[j][a]**2),0)/total));
}

// Simple PCA first two PCs by power iteration on covariance in feature space
function pca2(X){
  const c=center(X).X,n=X.length,p=X[0].length;
  const C=Array.from({length:p},()=>Array(p).fill(0));
  for(let j=0;j<p;j++)for(let k=0;k<p;k++){let s=0;for(let i=0;i<n;i++)s+=c[i][j]*c[i][k];C[j][k]=s/Math.max(1,n-1);}
  const eig1=powerEig(C),C2=C.map((r,j)=>r.map((v,k)=>v-eig1.val*eig1.vec[j]*eig1.vec[k])),eig2=powerEig(C2);
  const scores=c.map(r=>[dot(r,eig1.vec),dot(r,eig2.vec)]);
  const tr=C.reduce((s,r,i)=>s+r[i],0)||1;
  return {scores,explained:[100*eig1.val/tr,100*eig2.val/tr]};
}
function powerEig(A){
  const n=A.length;let v=Array(n).fill(1/Math.sqrt(n)),val=0;
  for(let it=0;it<120;it++){let w=matVec(A,v),norm=Math.sqrt(dot(w,w))||1;v=w.map(x=>x/norm);val=dot(v,matVec(A,v));}
  return {vec:v,val:Math.max(0,val)};
}

// ---------- Plots ----------
function drawScatter(canvas,x,y,labels,xlab,ylab,title,identity=false){
  const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);ctx.fillStyle='white';ctx.fillRect(0,0,W,H);
  if(!x.length)return;const pad={l:60,r:25,t:35,b:50},xmin=Math.min(...x),xmax=Math.max(...x),ymin=Math.min(...y),ymax=Math.max(...y);
  const mn=identity?Math.min(xmin,ymin):xmin,mx=identity?Math.max(xmax,ymax):xmax,xxr=(mx-mn)||1,ylo=identity?mn:ymin,yhi=identity?mx:ymax,yrr=(yhi-ylo)||1;
  const sx=v=>pad.l+(v-mn)/xxr*(W-pad.l-pad.r),sy=v=>H-pad.b-(v-ylo)/yrr*(H-pad.t-pad.b);
  axes(ctx,W,H,pad,title,xlab,ylab);
  if(identity){ctx.strokeStyle='#9ca3af';ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(sx(mn),sy(mn));ctx.lineTo(sx(mx),sy(mx));ctx.stroke();ctx.setLineDash([]);}
  x.forEach((v,i)=>{ctx.fillStyle=colors[i%colors.length];ctx.beginPath();ctx.arc(sx(v),sy(y[i]),5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#374151';ctx.font='10px Arial';ctx.fillText(labels[i]||'',sx(v)+6,sy(y[i])-6);});
}
function axes(ctx,W,H,pad,title,xlab,ylab){
  ctx.strokeStyle='#cfd4dc';ctx.beginPath();ctx.moveTo(pad.l,pad.t);ctx.lineTo(pad.l,H-pad.b);ctx.lineTo(W-pad.r,H-pad.b);ctx.stroke();
  ctx.fillStyle='#111827';ctx.font='bold 14px Arial';ctx.fillText(title,pad.l,20);ctx.font='12px Arial';ctx.fillText(xlab,W/2-35,H-12);
  ctx.save();ctx.translate(16,H/2+20);ctx.rotate(-Math.PI/2);ctx.fillText(ylab,0,0);ctx.restore();
}
function drawBars(canvas,labels,vals,title){
  const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);ctx.fillStyle='white';ctx.fillRect(0,0,W,H);
  if(!vals.length)return;const pad={l:55,r:20,t:35,b:70},max=Math.max(...vals,1),bw=(W-pad.l-pad.r)/vals.length*.65;
  axes(ctx,W,H,pad,title,'','');
  vals.forEach((v,i)=>{const x=pad.l+(i+.5)*(W-pad.l-pad.r)/vals.length-bw/2,h=(H-pad.t-pad.b)*v/max;ctx.fillStyle=colors[i%colors.length];ctx.fillRect(x,H-pad.b-h,bw,h);ctx.save();ctx.translate(x+bw/2,H-pad.b+15);ctx.rotate(-Math.PI/4);ctx.fillStyle='#374151';ctx.font='10px Arial';ctx.fillText(labels[i],0,0);ctx.restore();});
}
function drawResidual(canvas,res,labels){drawScatter(canvas,labels.map((_,i)=>i+1),res,labels,'Sample','Residual','Resíduos CV');}
function drawVIP(canvas,wl,vip){
  const top=vip.map((v,i)=>({v,w:wl[i]})).sort((a,b)=>b.v-a.v).slice(0,30).sort((a,b)=>a.w-b.w);
  drawBars(canvas,top.map(o=>String(o.w)),top.map(o=>o.v),'VIP (30 maiores)');
}

updateDataSummary(); renderModelSummary();
