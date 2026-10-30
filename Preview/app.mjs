import * as THREE from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { RoomEnvironment } from './vendor/environments/RoomEnvironment.js';
import { WorldStore, CATEGORIES, seed, benjiItem } from './state.mjs';

import { createBenji } from './benji.mjs';
import { createMercedes } from './mercedes.mjs';
import { SharedWorldStore } from './shared-state.mjs';
import { bindWorldGestures } from './gestures.mjs';
import { mountCheckins, todayDate } from './checkins.mjs';
import { reflectionSource } from './reflection-items.mjs';
import { addDesert } from './desert.mjs';

const $ = id => document.getElementById(id);
const canvas = $('world');
const defaults = seed();
defaults.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let store;
const publicView = document.body.dataset.publicView === 'true';
try {
  const response=await fetch(new URL(publicView?'../shared-world.json':'../api/world',import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(response.status===404&&!publicView&&!/\/mandala\/[a-f0-9]{64}\//.test(location.pathname))store=new WorldStore(localStorage,defaults);
  else if(response.ok){
    const snapshot=await response.json();
    if(publicView&&snapshot.readOnly!==true)throw new Error('Shared view is unavailable.');
    if(snapshot.readOnly){store=new WorldStore({getItem:()=>null,setItem:()=>{}},snapshot.state);store.readOnly=true;store.blocked=true;store.status='Shared view · view only';}
    else store=new SharedWorldStore(snapshot);
  }
  else throw new Error('Private access could not be verified. Check your Tailscale connection and reload.');
}catch(error){$('loading').textContent='Your world could not connect. Check your connection and reload.';$('save-status').textContent='World unavailable · existing saves preserved';throw error;}
const colors = {Person: '#e5b56d', Pet: '#81b99a', Object: '#c9ad78', Idea: '#8ebbcf', Feeling: '#c598ba'};
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#cbbba1', 70, 310);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, .08, 1200);
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: false, powerPreference: 'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .72;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, .04).texture;
room.dispose(); pmrem.dispose();
scene.environmentIntensity = .36;
const skyMaterial = new THREE.ShaderMaterial({side: THREE.BackSide, depthWrite: false,
  uniforms: {top: {value: new THREE.Color('#6998a7')}, bottom: {value: new THREE.Color('#f2c590')}},
  vertexShader: 'varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader: 'varying vec3 vWorld;uniform vec3 top;uniform vec3 bottom;void main(){float h=pow(max(normalize(vWorld).y,0.0),0.55);gl_FragColor=vec4(mix(bottom,top,h),1.0);}'
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(850, 32, 20), skyMaterial));
const hemisphere = new THREE.HemisphereLight('#d1e5ec', '#6a6441', 1.15); scene.add(hemisphere);
const sun = new THREE.DirectionalLight('#ffd3a0', 3.1); sun.position.set(-22, 15, -18); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -23; sun.shadow.camera.right = 23;
sun.shadow.camera.top = 23; sun.shadow.camera.bottom = -23; sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
sun.shadow.normalBias = .035; sun.shadow.bias = -.0001; scene.add(sun);
const itemRoot = new THREE.Group(); scene.add(itemRoot);
const ring = new THREE.Mesh(new THREE.TorusGeometry(.62, .012, 8, 80), new THREE.MeshBasicMaterial({color: '#def2b6'}));
ring.rotation.x = Math.PI / 2; ring.visible = false; scene.add(ring);
let selected = null, overview = false, yaw = 0, pitch = .015, distance = 24, currentTime = 0;
const targetPosition = new THREE.Vector3(), targetLook = new THREE.Vector3(), projected = new THREE.Vector3();
const itemGroups = new Map();
const raycaster = new THREE.Raycaster();
let worldLoaded = false;
const todayMarker=Symbol('Today marker');
let checkinPanel=null;

function toast(message) {
  $('notice').textContent = message; $('notice').hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => {$('notice').hidden = true;}, 5500);
}
function material(color, options = {}) { return new THREE.MeshStandardMaterial({color, roughness: .28, metalness: .35, ...options}); }
function mesh(geometry, mat, group, position = [0,0,0]) {
  const object = new THREE.Mesh(geometry, mat); object.position.set(...position);
  object.castShadow = true; object.receiveShadow = true; group.add(object); return object;
}
function createItem(item) {
  const group = new THREE.Group(); group.userData.itemId = item.id;
  group.position.set(Math.sin(item.angle) * item.radius, 0, -Math.cos(item.angle) * item.radius);
  group.scale.setScalar(item.scale);
  const isBenji = item.appearance === 'benji-study';
  const isMercedes = item.appearance === 'mercedes-study' || (item.category==='Person'&&item.name.toLowerCase()==='mercedes');
  const isCharacter = isBenji || isMercedes;
  const isToday = item.id===todayMarker;
  if (!isCharacter) {
  mesh(new THREE.CylinderGeometry(.36,.42,.10,48), material('#9f7440',{metalness:.8,roughness:.3}), group, [0,.07,0]);
  mesh(new THREE.CylinderGeometry(.27,.28,.24,48), material('#d3c9b2',{roughness:.62,metalness:0}), group, [0,.22,0]);
  }
  const symbol = isBenji ? createBenji() : isMercedes ? createMercedes() : new THREE.Group(); group.add(symbol); symbol.position.y = isCharacter ? 0 : .86;
  const color = colors[item.category]; const main = material(color,{emissive:color,emissiveIntensity:.055});
  if (isCharacter) {
    main.dispose();
  } else if(isToday){
    mesh(new THREE.SphereGeometry(.24,32,24),material('#c6dfb4',{emissive:'#8ec8af',emissiveIntensity:.35,roughness:.4}),symbol);
    const halo=mesh(new THREE.TorusGeometry(.36,.02,10,64),material('#d5c492',{metalness:.7}),symbol);halo.rotation.x=Math.PI/2;
    mesh(new THREE.CylinderGeometry(.12,.16,.14,32),material('#b5a172',{metalness:.5}),symbol,[0,-.32,0]);
  } else if (item.category === 'Person') {
    mesh(new THREE.SphereGeometry(.19,32,24),main,symbol,[0,.28,0]);
    mesh(new THREE.CapsuleGeometry(.16,.26,8,24),main,symbol,[0,-.11,0]);
    const halo = mesh(new THREE.TorusGeometry(.43,.012,8,64),material('#e8cc8e',{metalness:.7}),symbol,[0,.05,0]); halo.rotation.y = .2;
  } else if (item.category === 'Pet') {
    mesh(new THREE.SphereGeometry(.25,28,20),main,symbol,[0,-.05,0]);
    mesh(new THREE.SphereGeometry(.16,24,16),main,symbol,[0,.24,-.04]);
    for (const x of [-.12,.12]) mesh(new THREE.ConeGeometry(.075,.2,20),main,symbol,[x,.4,-.04]);
  } else if (item.category === 'Idea') {
    mesh(new THREE.IcosahedronGeometry(.36,0),material(color,{metalness:.55,roughness:.15}),symbol);
    const halo=mesh(new THREE.TorusGeometry(.48,.013,8,64),main,symbol); halo.rotation.x=Math.PI/2+.35;
  } else if (item.category === 'Feeling') {
    mesh(new THREE.SphereGeometry(.33,40,32),material(color,{metalness:.55,roughness:.19}),symbol);
    const halo=mesh(new THREE.TorusGeometry(.43,.02,10,64),material('#e6c8db'),symbol);halo.rotation.set(.6,.5,0);
  } else {
    const stone=mesh(new THREE.DodecahedronGeometry(.34,0),main,symbol);stone.rotation.set(.25,.3,.1);
  }
  group.userData.symbol=symbol; group.userData.baseY=isCharacter ? 0 : .86; group.userData.isBenji=isBenji;
  group.userData.facing=isCharacter ? -item.angle : 0;
  group.userData.labelHeight=new THREE.Box3().setFromObject(group).max.y+.10*item.scale;
  group.traverse(child=>{child.userData.itemId=item.id;});
  const label=document.createElement('button');label.className='world-label';label.textContent=item.name;
  if(isToday)label.classList.add('today-marker-label');
  label.setAttribute('aria-label',isToday?'Today marker. Open your daily check-in.':`${item.name}, ${item.category}.${store.readOnly?'':' Select to edit.'}`);label.addEventListener('click',()=>select(item.id));
  $('labels').append(label); group.userData.label=label;
  itemRoot.add(group); itemGroups.set(item.id,group);
}
function rebuild() {
  for (const group of itemGroups.values()) {
    group.traverse(child=>{if(child.geometry)child.geometry.dispose();if(child.material)child.material.dispose();});
    group.userData.label.remove(); itemRoot.remove(group);
  }
  itemGroups.clear();store.state.items.forEach(createItem);
  if(store.shared)createItem({id:todayMarker,name:'◉ Today',category:'Object',angle:-.45,radius:2.2,scale:1});
  if(!store.state.items.some(item=>item.id===selected))selected=null;
  applyEnvironment(); syncUI();
}
function syncUI() {
  $('save-status').textContent=store.status;
  $('item-count').textContent=`${store.state.items.length} ${store.state.items.length===1?'thing':'things'} in your world`;
  $('undo').disabled=!store.history.length||store.blocked;
  $('add').disabled=store.blocked;
  $('motion').checked=store.state.reducedMotion;
  document.querySelectorAll('[data-environment]').forEach(button=>button.classList.toggle('active',button.dataset.environment===store.state.environment));
  const item=store.state.items.find(item=>item.id===selected);
  $('inspector').hidden=store.readOnly||!item;
  for(const [id,group]of itemGroups)group.userData.label.classList.toggle('selected',id===selected);
  if(item){$('category').textContent=item.category.toUpperCase();$('item-name').value=item.name;$('item-note').value=item.note;$('item-scale').value=item.scale;$('scale-value').textContent=`${item.scale.toFixed(1)}×`;}
  const source=item?reflectionSource(item.id):null;
  $('open-item-checkin').hidden=store.readOnly||!source;
  $('open-item-checkin').onclick=()=>{if(source)checkinPanel?.open(source.date);};
  $('inspector').querySelectorAll('input,textarea,button:not(#close-inspector)').forEach(el=>el.disabled=store.blocked);
}
function select(id){if(store.readOnly)return;if(id===todayMarker){checkinPanel?.open(todayDate(),'world');return;}selected=id;syncUI();}
function editSelected(change){if(!selected||store.blocked)return;store.commit(state=>{const item=state.items.find(item=>item.id===selected);if(item)change(item);});rebuild();}
function panel(id,button){const opening=$(id).hidden;['add-panel','settings'].forEach(name=>{$(name).hidden=true;});$('add').setAttribute('aria-expanded','false');$('atmosphere').setAttribute('aria-expanded','false');$(id).hidden=!opening;$(button).setAttribute('aria-expanded',String(opening));}
function toggleView(){overview=!overview;$('view').textContent=overview?'◎ Back to center':'◎ Overview';$('view').setAttribute('aria-pressed',String(overview));$('hint').innerHTML=overview?'Drag to orbit <span>·</span> Pinch or scroll to zoom':'Drag to look around <span>·</span> Pinch or scroll to zoom';updateZoomLabel();}
function applyEnvironment(){
  const values={golden:{top:'#7399ac',bottom:'#f4bd89',fog:'#cfad8f',sun:'#ffd0a0',power:3,ambient:1.1,exposure:.72,pos:[-22,15,-18]},daylight:{top:'#5d9cc4',bottom:'#edd7b8',fog:'#d1b99e',sun:'#fff2d7',power:3.4,ambient:1.3,exposure:.78,pos:[-8,32,-16]},blue:{top:'#203558',bottom:'#d28e91',fog:'#8f7880',sun:'#b4c6ed',power:.75,ambient:.65,exposure:.7,pos:[-22,6,-18]}}[store.state.environment];
  skyMaterial.uniforms.top.value.set(values.top);skyMaterial.uniforms.bottom.value.set(values.bottom);scene.fog.color.set(values.fog);
  sun.color.set(values.sun);sun.intensity=values.power;sun.position.set(...values.pos);hemisphere.intensity=values.ambient;renderer.toneMappingExposure=values.exposure;
}
for(const category of CATEGORIES){
  const button=document.createElement('button');const dot=document.createElement('span');dot.className='category-dot';dot.style.background=colors[category];button.append(dot,document.createTextNode(category));
  button.addEventListener('click',()=>{if(store.blocked)return;if(store.state.items.length>=80){toast('This study holds up to 80 things.');return;}const id=crypto.randomUUID();store.commit(state=>state.items.push({id,category,name:`A new ${category.toLowerCase()}`,note:'',angle:Math.atan2(Math.sin(yaw),Math.cos(yaw)),radius:7.2,scale:1}));selected=id;$('add-panel').hidden=true;$('add').setAttribute('aria-expanded','false');rebuild();$('item-name').focus();$('item-name').select();});$('categories').append(button);
}
$('add-benji').onclick=()=>{
  if(store.blocked)return;
  if(store.state.items.length>=80){toast('This study holds up to 80 things.');return;}
  const item=benjiItem(crypto.randomUUID(),Math.atan2(Math.sin(yaw),Math.cos(yaw)));
  store.commit(state=>state.items.push(item));selected=item.id;
  $('add-panel').hidden=true;$('add').setAttribute('aria-expanded','false');rebuild();
  toast('Benji is here. This companion study can evolve with your photos.');
};
$('add').onclick=()=>panel('add-panel','add');$('atmosphere').onclick=()=>panel('settings','atmosphere');$('view').onclick=toggleView;
$('undo').onclick=()=>{store.undo();rebuild();};$('close-inspector').onclick=()=>select(null);
$('item-name').addEventListener('change',event=>{const name=event.target.value.trim();if(!name){syncUI();return;}editSelected(item=>{item.name=name;});});
$('item-note').addEventListener('change',event=>editSelected(item=>{item.note=event.target.value;}));
$('item-scale').addEventListener('change',event=>editSelected(item=>{item.scale=Number(event.target.value);}));
$('item-scale').addEventListener('input',event=>{$('scale-value').textContent=`${Number(event.target.value).toFixed(1)}×`;});
document.querySelectorAll('[data-move]').forEach(button=>button.onclick=()=>editSelected(item=>{const direction=button.dataset.move;if(direction==='closer'||direction==='farther')item.radius=THREE.MathUtils.clamp(item.radius+(direction==='closer'?-.5:.5),2,15);else item.angle=Math.atan2(Math.sin(item.angle+(direction==='left'?-.12:.12)),Math.cos(item.angle+(direction==='left'?-.12:.12)));}));
$('remove').onclick=()=>{if(!selected)return;store.commit(state=>{state.items=state.items.filter(item=>item.id!==selected);});selected=null;rebuild();toast('Removed. Undo brings it back.');};
document.querySelectorAll('[data-environment]').forEach(button=>button.onclick=()=>{store.commit(state=>{state.environment=button.dataset.environment;});applyEnvironment();syncUI();});
$('motion').onchange=event=>{store.commit(state=>{state.reducedMotion=event.target.checked;});syncUI();};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(store.state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='my-mandala-study.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Your world has been exported.');};
$('import').onclick=()=>{if(store.blocked){toast('Existing save needs recovery before importing. Original remains untouched.');return;}$('import-file').click();};
$('import-file').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>1024*1024)throw new Error('Choose a world file smaller than 1 MB.');store.import(await file.text());selected=null;rebuild();toast('World imported. Undo restores your previous world.');}catch(error){toast(error.message);}event.target.value='';};

const maximumZoom=5;
const minimumFov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(62/2))/maximumZoom));
function updateZoomLabel(){
  const factor=overview?24/distance:Math.tan(THREE.MathUtils.degToRad(62/2))/Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  $('zoom-level').textContent=`${Math.round(factor*100)}%`;
  const resolution=Math.min(devicePixelRatio,factor>=2?3:1.75);
  if(renderer.getPixelRatio()!==resolution)renderer.setPixelRatio(resolution);
}
function zoomWorld(ratio){
  if(!Number.isFinite(ratio)||ratio<=0)return;
  if(overview)distance=THREE.MathUtils.clamp(distance/ratio,24/maximumZoom,48);
  else{camera.fov=THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/ratio)),minimumFov,85);camera.updateProjectionMatrix();}
  updateZoomLabel();
}
const gesture=bindWorldGestures(canvas,{
  rotate:(dx,dy)=>{yaw-=dx*.0035;if(!overview)pitch=THREE.MathUtils.clamp(pitch+dy*.003,-.45,.8);},
  zoom:zoomWorld,
  pick:(x,y)=>{raycaster.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,-y/innerHeight*2+1),camera);const hit=raycaster.intersectObjects(itemRoot.children,true)[0];select(hit?hit.object.userData.itemId:null);}
});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
canvas.addEventListener('wheel',event=>{event.preventDefault();zoomWorld(Math.exp(-event.deltaY*.002));},{passive:false});
$('zoom-in').onclick=()=>zoomWorld(1.25);$('zoom-out').onclick=()=>zoomWorld(1/1.25);
document.addEventListener('keydown',event=>{if(['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;
  if(event.key==='Escape'){select(null);$('add-panel').hidden=true;$('settings').hidden=true;}
  if(event.key.toLowerCase()==='o')toggleView();
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();store.undo();rebuild();}
  if(event.key==='ArrowLeft'){event.preventDefault();yaw-=.1;}if(event.key==='ArrowRight'){event.preventDefault();yaw+=.1;}
  if(event.key==='ArrowUp'){event.preventDefault();pitch=THREE.MathUtils.clamp(pitch+.06,-.45,.8);}if(event.key==='ArrowDown'){event.preventDefault();pitch=THREE.MathUtils.clamp(pitch-.06,-.45,.8);}
});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
new GLTFLoader().load('../Art/Sanctuary.glb',gltf=>{
  gltf.scene.traverse(object=>{if(object.isMesh){object.receiveShadow=true;object.castShadow=!object.name.toLowerCase().includes('mountain');if(object.material){const list=Array.isArray(object.material)?object.material:[object.material];for(const mat of list){mat.envMapIntensity=.5;if(mat.name==='Meadow')mat.color.set('#c8a77c');if(mat.name==='Distant granite')mat.color.set('#ac8069');if(/leaf|petal|foliage|greenery|flower/i.test(mat.name))mat.side=THREE.DoubleSide;}}}});
  scene.add(gltf.scene);worldLoaded=true;$('loading').hidden=true;
},undefined,error=>{$('loading').hidden=true;toast('Garden art could not load. Object editing is available; reload once the art export is ready.');console.error('Garden model load failed',error);});
addDesert(scene); rebuild();
if(store.shared){
  checkinPanel=mountCheckins({world:store,onWorldChange:rebuild,onShowWorld:()=>{selected=null;syncUI();if(!overview)toggleView();distance=18;camera.fov=62;camera.updateProjectionMatrix();updateZoomLabel();toast('Your visible choices are saved in the mandala.');}});
  document.title='Your mandala · Scottsdale sanctuary';
  document.querySelector('.study').textContent='Your private world';
  document.querySelector('.bottom-note span:last-child').textContent='Private · shared across your devices';
  store.onStatus=syncUI;store.onChange=rebuild;toggleView();
  $('retry-save').hidden=false;$('retry-save').onclick=()=>store.refresh();
  setInterval(()=>{if(!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!gesture.active)void store.refresh();},10000);
  addEventListener('online',()=>store.refresh());
}
if(store.readOnly){
  document.body.classList.add('read-only');document.title='Mandala · Shared sanctuary';
  document.querySelector('.study').textContent='Shared sanctuary';
  document.querySelector('.bottom-note span:last-child').textContent='Shared copy · view only';
  for(const id of ['add','undo','today','atmosphere'])$(id).hidden=true;
  toggleView();
}
if(store.blocked&&!store.readOnly)toast('Your existing saved world could not be read. It has been preserved; editing is paused.');
const clock=new THREE.Clock();
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);currentTime+=dt;
  if(overview){targetPosition.set(Math.sin(yaw)*distance,distance*.57,Math.cos(yaw)*distance);targetLook.set(0,.4,0);}else{targetPosition.set(0,1.9,0);targetLook.set(Math.sin(yaw)*Math.cos(pitch)*10,1.9+Math.sin(pitch)*10,-Math.cos(yaw)*Math.cos(pitch)*10);}
  camera.position.lerp(targetPosition,store.state.reducedMotion?1:1-Math.exp(-dt*7));camera.lookAt(targetLook);
  for(const [id,group]of itemGroups){const symbol=group.userData.symbol;symbol.position.y=group.userData.baseY+(store.state.reducedMotion||group.userData.isBenji?0:Math.sin(currentTime*.8+group.position.x)*.035);symbol.rotation.y=group.userData.facing+(store.state.reducedMotion||group.userData.isBenji?0:Math.sin(currentTime*.22)*.1);
    if(group.userData.isBenji)symbol.userData.tail.rotation.z=store.state.reducedMotion?0:Math.sin(currentTime*1.6)*.12;
    projected.copy(group.position);projected.y=group.userData.labelHeight;projected.project(camera);const label=group.userData.label;
    const visible=projected.z>-1&&projected.z<1&&Math.abs(projected.x)<.96&&Math.abs(projected.y)<.80;
    label.hidden=!visible;if(visible){const halfWidth=label.offsetWidth/2;label.style.left=`${THREE.MathUtils.clamp((projected.x*.5+.5)*innerWidth,halfWidth+8,innerWidth-halfWidth-8)}px`;label.style.top=`${(-projected.y*.5+.5)*innerHeight-12}px`;}}
  const active=itemGroups.get(selected);ring.visible=!!active;if(active){ring.position.copy(active.position);ring.position.y=.02;ring.scale.setScalar(active.scale.x);}
  renderer.render(scene,camera);
}
camera.position.set(0,1.9,0);animate();
window.mandalaStudy={getState:()=>JSON.parse(JSON.stringify(store.state)),isArtLoaded:()=>worldLoaded,rendererInfo:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles})};
