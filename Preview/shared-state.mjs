import { WorldStore, KEY, clone, validate } from './state.mjs';

// The server is authoritative. A browser draft only protects an unsaved edit.
export class SharedWorldStore extends WorldStore {
  constructor(snapshot, {fetcher=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(15000)}), drafts=localStorage}={}) {
    const memory = new Map([[KEY, JSON.stringify(validate(snapshot.state))]]);
    super({getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)},snapshot.state);
    this.fetcher=fetcher; this.drafts=drafts; this.revision=snapshot.revision;
    this.status='Saved across your devices'; this.pending=false; this.sending=false;
    this.onChange=()=>{}; this.onStatus=()=>{}; this.shared=true;
    try {
      const draft=JSON.parse(drafts.getItem('mandala-shared-draft')||'null');
      if(draft) {
        const state=validate(draft.state);
        if(JSON.stringify(state)===JSON.stringify(this.state))drafts.removeItem('mandala-shared-draft');
        else {
          this.state=state; this.pending=true;
          if(draft.revision!==this.revision){this.blocked=true;this.status='Unsaved draft · export before reloading';}
          else this.status='Recovered unsaved edit · retry save';
        }
      }
    } catch { this.blocked=true;this.status='Browser draft needs recovery · original preserved'; }
  }
  save() {
    if(this.blocked)return false;
    this.pending=true;
    try {this.drafts.setItem('mandala-shared-draft',JSON.stringify({revision:this.revision,state:validate(this.state)}));}
    catch {this.status='Browser backup unavailable · export a copy';this.onStatus();return false;}
    this.status='Saving to your world…';this.onStatus();void this.flush();return true;
  }
  async flush() {
    if(this.sending||!this.pending||this.blocked)return;
    this.sending=true;
    try {
      while(this.pending&&!this.blocked) {
        const state=clone(this.state);this.pending=false;
        const response=await this.fetcher('/api/world',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:this.revision,state})});
        if(response.status===409){this.blocked=true;this.pending=true;this.status='Changed on another device · export your edit, then reload';break;}
        if(!response.ok)throw new Error('Save unavailable');
        const result=await response.json();this.revision=result.revision;
        if(JSON.stringify(this.state)!==JSON.stringify(state))this.pending=true;
        if(!this.pending){this.drafts.removeItem('mandala-shared-draft');this.status='Saved across your devices';}
        else this.drafts.setItem('mandala-shared-draft',JSON.stringify({revision:this.revision,state:this.state}));
      }
    } catch {this.pending=true;this.status='Unsaved · retry save or export a copy';}
    finally {this.sending=false;this.onStatus();}
  }
  async refresh() {
    if(this.sending||this.blocked)return;
    try {
      const response=await this.fetcher('/api/world',{cache:'no-store'});
      if(!response.ok)throw new Error('World unavailable');
      const result=await response.json();const state=validate(result.state);
      if(this.pending) {
        if(JSON.stringify(state)===JSON.stringify(this.state)){
          this.revision=result.revision;this.pending=false;this.drafts.removeItem('mandala-shared-draft');this.status='Saved across your devices';this.onStatus();return;
        }
        if(result.revision!==this.revision){this.blocked=true;this.status='Changed on another device · export your edit, then reload';this.onStatus();return;}
        await this.flush();return;
      }
      if(result.revision!==this.revision){this.state=state;this.revision=result.revision;this.history=[];this.status='Updated from your other device';this.onChange();}
    } catch {this.status=this.pending?'Unsaved · reconnect or export a copy':'Connection interrupted · saved world kept on your Mac';this.onStatus();}
  }
  async waitForSave(){
    while(this.sending)await new Promise(resolve=>setTimeout(resolve,20));
    if(this.pending||this.blocked)throw new Error(this.status);
  }
}
