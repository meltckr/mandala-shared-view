import {REFLECTION_FIELDS,reflectionId,applyReflectionChoices} from './reflection-items.mjs';
const textLimits={body:2000,emotions:500,thoughts:4000,intention:500};
export function todayDate(now=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Phoenix',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function emptyCheckin(date=todayDate()){return{date,body:'',energy:null,emotions:'',thoughts:'',intention:''};}
export function validateCheckin(entry,{allowEmpty=false}={}){
  if(!entry||!/^\d{4}-\d{2}-\d{2}$/.test(entry.date))throw new Error('Choose a valid date.');
  const date=new Date(entry.date+'T12:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==entry.date)throw new Error('Choose a valid date.');
  for(const [key,limit]of Object.entries(textLimits))if(typeof entry[key]!=='string'||entry[key].length>limit)throw new Error('One of your notes is too long.');
  if(entry.energy!==null&&(!Number.isInteger(entry.energy)||entry.energy<1||entry.energy>5))throw new Error('Choose an energy level.');
  if(!allowEmpty&&entry.energy===null&&!Object.keys(textLimits).some(key=>entry[key].trim()))throw new Error('Add something you would like to record.');
  return{date:entry.date,body:entry.body,energy:entry.energy,emotions:entry.emotions,thoughts:entry.thoughts,intention:entry.intention};
}
export class CheckinStore{
  constructor({fetcher=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(15000)}),drafts=localStorage}={}){this.fetcher=fetcher;this.drafts=drafts;this.entries=[];this.revision=0;this.ready=false;}
  async load(){
    const response=await this.fetcher('/api/checkins',{cache:'no-store'});
    if(!response.ok)throw new Error('Your check-ins could not connect. Try again in a moment.');
    const value=await response.json();
    if(!Number.isInteger(value.revision)||!Array.isArray(value.entries))throw new Error('Your saved check-ins need recovery. Existing data is preserved.');
    for(const entry of value.entries)validateCheckin(entry);
    this.revision=value.revision;this.entries=value.entries;this.ready=true;return value;
  }
  entry(date){return this.entries.find(entry=>entry.date===date);}
  draft(date){const raw=this.drafts.getItem('mandala-checkin-draft:'+date);if(!raw)return null;const draft=JSON.parse(raw);if(!Number.isInteger(draft.revision)||draft.revision<0||draft.fields?.date!==date)throw new Error('Invalid browser draft');return{revision:draft.revision,fields:validateCheckin(draft.fields,{allowEmpty:true})};}
  keepDraft(fields){this.drafts.setItem('mandala-checkin-draft:'+fields.date,JSON.stringify({revision:this.revision,fields}));}
  async save(fields){
    if(!this.ready)throw new Error('Load your saved check-ins before saving.');
    const entry={...validateCheckin(fields),updatedAt:new Date().toISOString()};
    this.keepDraft(fields);
    const response=await this.fetcher('/api/checkins',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:this.revision,entry})});
    if(response.status===409)throw new Error('A check-in changed on another device. Your draft is kept. Use “Load saved” to review it, then restore your draft if needed.');
    if(!response.ok)throw new Error('This check-in has not saved. Your draft is kept in this browser; try again.');
    const result=await response.json();this.revision=result.revision;this.entries=result.entries;
    this.drafts.removeItem('mandala-checkin-draft:'+fields.date);return entry;
  }
}

export function mountCheckins({world,onWorldChange=()=>{},onShowWorld=()=>{}}={}){
  const $=id=>document.getElementById(id);const client=new CheckinStore();
  const dialog=$('checkin-dialog'),form=$('checkin-form'),fieldset=$('checkin-fields');
  let activeDate=todayDate(),busy=false;
  const message=text=>{$('checkin-status').textContent=text;};
  function lock(value){busy=value;fieldset.disabled=value||!client.ready;$('reflection-options').disabled=value;for(const id of ['tab-reflection','tab-world','load-checkins','restore-checkin-draft'])$(id).disabled=value;}
  function showTab(tab){
    for(const name of ['reflection','world']){const active=name===tab;$('checkin-'+name).hidden=!active;$('tab-'+name).setAttribute('aria-selected',String(active));$('tab-'+name).tabIndex=active?0:-1;}
  }
  function visibilityOptions(){
    const entry=client.entry(activeDate);$('reflection-date').textContent=`Saved reflection · ${activeDate}`;
    $('reflection-choices').replaceChildren();
    for(const spec of REFLECTION_FIELDS){
      const item=world?.state.items.find(item=>item.id===reflectionId(activeDate,spec.field));
      const available=!!entry?.[spec.field]?.trim();
      const row=document.createElement('div');row.className='reflection-choice';
      const label=document.createElement('label');label.className='reflection-toggle';
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.id='show-'+spec.field;checkbox.checked=!!item;checkbox.disabled=!available&&!item;
      label.append(checkbox,document.createTextNode(`${spec.title} · ${spec.shape}`));
      const titleLabel=document.createElement('label');titleLabel.htmlFor='reflection-label-'+spec.field;titleLabel.className='small-note';titleLabel.textContent='Visible label';
      const title=document.createElement('input');title.id='reflection-label-'+spec.field;title.maxLength=80;title.type='text';title.value=item?.name||(entry?.[spec.field]||'').trim().slice(0,80);title.disabled=!checkbox.checked||!available;
      checkbox.onchange=()=>{title.disabled=!checkbox.checked||!available;};
      const note=document.createElement('p');note.className='small-note';note.textContent=available?'Only this label will appear; your full note stays in the check-in.':item?'This field is empty now. Uncheck it to hide its existing object.':'Save something in this field to bring it into your mandala.';
      row.append(label,titleLabel,title,note);$('reflection-choices').append(row);
    }
    $('apply-reflections').disabled=!entry||!world||world.blocked;
    $('reflection-status').textContent=entry?'Checked items will show. Unchecked items will be hidden when you apply.':'Save this day’s check-in first, then choose what appears here.';
  }
  function fields(){return{date:activeDate,body:$('checkin-body').value,energy:$('checkin-energy').value?Number($('checkin-energy').value):null,emotions:$('checkin-emotions').value,thoughts:$('checkin-thoughts').value,intention:$('checkin-intention').value};}
  function fill(entry){for(const key of Object.keys(textLimits))$('checkin-'+key).value=entry[key];$('checkin-energy').value=entry.energy??'';}
  function recent(){
    $('checkin-history').replaceChildren();
    for(const entry of [...client.entries].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7)){
      const button=document.createElement('button');button.type='button';button.textContent=entry.date;
      button.onclick=()=>{if(busy)return;selectDate(entry.date);};$('checkin-history').append(button);
    }
    $('checkin-history-empty').hidden=client.entries.length>0;
  }
  function selectDate(date,restore=true){
    activeDate=date;$('checkin-date').value=date;
    fill(client.entry(date)||emptyCheckin(date));
    $('restore-checkin-draft').hidden=true;
    message(client.entry(date)?'Your saved reflection. You can update it.':'Record what feels useful; leave the rest blank.');
    try{
      const draft=client.draft(date);
      if(draft){$('restore-checkin-draft').hidden=false;if(restore&&draft.revision===client.revision){fill(draft.fields);message('Your unsaved draft has been restored.');}else message('There is an unsaved browser draft for this date. You can restore it.');}
    }catch{message('A browser draft needs recovery. It has been preserved.');}
    visibilityOptions();
  }
  async function load(restore=true){
    lock(true);message('Opening your private check-ins…');$('reflection-status').textContent='Opening your saved reflection…';
    try{await client.load();selectDate(activeDate,restore);recent();}
    catch(error){message(error.message);$('reflection-status').textContent=error.message;$('apply-reflections').disabled=true;}
    finally{lock(false);}
  }
  function open(date=todayDate(),tab='reflection'){activeDate=date;showTab(tab);if(!dialog.open)dialog.showModal();void load();}
  $('today').onclick=()=>open();
  for(const name of ['reflection','world']){
    $('tab-'+name).onclick=()=>showTab(name);
    $('tab-'+name).onkeydown=event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();const next=name==='world'?'reflection':'world';showTab(next);$('tab-'+next).focus();}};
  }
  $('close-checkin').onclick=()=>dialog.close();
  $('load-checkins').onclick=()=>{if(!busy)void load(false);};
  $('restore-checkin-draft').onclick=()=>{try{const draft=client.draft(activeDate);if(draft){fill(draft.fields);message('Draft restored. Save when you have reviewed it.');}}catch{message('The draft could not be read. It has been preserved.');}};
  $('checkin-date').onchange=event=>{if(event.target.value)selectDate(event.target.value);};
  form.addEventListener('input',event=>{if(event.target.id==='checkin-date'||busy)return;try{client.keepDraft(fields());message('Draft kept in this browser. Tap Save check-in when ready.');}catch{message('Browser draft storage is unavailable. Keep this window open and save when ready.');}});
  form.onsubmit=async event=>{
    event.preventDefault();if(busy||!client.ready)return;
    lock(true);message('Saving your check-in…');
    try{await client.save(fields());message('Check-in saved privately across your devices.');$('restore-checkin-draft').hidden=true;recent();visibilityOptions();showTab('world');}
    catch(error){message(error.message);try{$('restore-checkin-draft').hidden=!client.draft(activeDate);}catch{$('restore-checkin-draft').hidden=true;}}
    finally{lock(false);}
  };
  $('apply-reflections').onclick=async()=>{
    if(busy||!world)return;
    const entry=client.entry(activeDate);if(!entry)return;
    const choices=Object.fromEntries(REFLECTION_FIELDS.map(spec=>[spec.field,{visible:$('show-'+spec.field).checked,label:$('reflection-label-'+spec.field).value.trim()}]));
    lock(true);$('reflection-status').textContent='Updating your mandala…';
    try{
      await world.waitForSave();await world.refresh();await world.waitForSave();
      const next=applyReflectionChoices(world.state,entry,choices);
      if(JSON.stringify(next)!==JSON.stringify(world.state)){world.commit(state=>Object.assign(state,next));onWorldChange();await world.waitForSave();}
      $('reflection-status').textContent='Your visible choices are saved.';dialog.close();onShowWorld();
    }catch(error){$('reflection-status').textContent=`Your reflection is kept. ${error.message}`;}
    finally{lock(false);}
  };
  $('today').hidden=false;
  return{open};
}
