/* Exact local side fits. The UI owns helper Workers; this coordinator owns only
 * their ports. Raster inputs are cloned, never transferred from the primary. */
(function(root){
  'use strict';
  function create({requestPool,stopPool,readyTimeoutMs=1500,taskTimeoutMs=5000}={}){
    const B=root.ReconstructionBranches||(typeof require==='function'?require('./reconstruction-branches.js'):null);
    let ports=[],requested=false,unavailable=false,disposed=false,stopRequested=false,readyResolve=null,readyTimer=null,active=null,runId=0,queue=Promise.resolve(),stopping=Promise.resolve();
    function close(incoming){for(const entry of incoming){const port=entry.port||entry;try{port.onmessage=null;port.onmessageerror=null;port.close();}catch(_){}}}
    function ready(value){if(readyResolve){clearTimeout(readyTimer);const resolve=readyResolve;readyResolve=null;resolve(value);}}
    function fail(){
      unavailable=true;for(const entry of ports)clearTimeout(entry.timer);close(ports);ports=[];ready(false);
      // Stop the UI-owned siblings before running their unfinished jobs locally.
      if(!stopRequested){stopRequested=true;try{stopping=Promise.resolve(stopPool&&stopPool()).catch(()=>{});}catch(_){stopping=Promise.resolve();}}
      if(active)active.finish(false);
      return stopping;
    }
    function attach(incoming){
      incoming=Array.isArray(incoming)?incoming:[];
      if(disposed||unavailable||ports.length){close(incoming);return;}
      if(!incoming.length){unavailable=true;ready(false);return;}
      ports=incoming.map(port=>({port,busy:null,timer:null}));
      for(const entry of ports){
        entry.port.onmessage=event=>{
          const data=event.data,run=active,job=entry.busy;
          // Late replies and replies for another analysis cannot occupy a slot.
          if(!run||!job||!data||data.runId!==run.id||data.index!==job.index)return;
          if(data.type==='error'&&run.mode!=='cells'){fail();return;}
          if(data.type!=='fit'&&data.type!=='error')return;
          clearTimeout(entry.timer);entry.timer=null;entry.busy=null;
          // Helpers prepare material only. Timed partition searches run later,
          // uncontended and in the same indexed order as the serial path.
          if(data.type==='fit'&&(run.mode!=='cells'||data.fit?.row&&data.fit?.raw))run.results.set(job.index,data.fit);
          run.remaining--;
          if(!run.remaining)run.finish(true);else run.dispatch(entry);
        };
        entry.port.onmessageerror=()=>fail();
        if(entry.port.start)entry.port.start();
      }
      ready(true);
    }
    async function ensureReady(){
      if(unavailable||disposed)return false;
      if(ports.length)return true;
      if(requested)return false;
      requested=true;
      const waiting=new Promise(resolve=>{readyResolve=resolve;readyTimer=setTimeout(()=>{fail();},readyTimeoutMs);});
      try{
        const requestedPorts=requestPool&&requestPool();
        if(Array.isArray(requestedPorts))attach(requestedPorts);
        else if(requestedPorts&&typeof requestedPorts.then==='function')requestedPorts.then(value=>{if(Array.isArray(value))attach(value);},()=>fail());
        else if(!requestPool)attach([]);
      }catch(_){fail();}
      return waiting;
    }
    async function perform(analysis,mode='branches',canonical,options={}){
      const sides=(analysis.sides12||analysis.sides).slice().sort((a,b)=>a.index-b.index),results=new Map();let attempted=0;
      if(!sides.length)return [];
      if(await ensureReady()&&!unavailable&&ports.length){
        const id=++runId,master=analysis.master;
        await new Promise(resolve=>{
          const run={id,mode,results,remaining:sides.length,next:0,finish(ok){
            if(active!==run)return;
            for(const entry of ports){clearTimeout(entry.timer);entry.timer=null;entry.busy=null;}
            active=null;resolve(ok);
          },dispatch(entry){
            if(active!==run||run.next>=sides.length)return;
            const original=sides[run.next++],side={...original};delete side.sourceInk;
            attempted++;
            entry.busy={index:original.index};
            entry.timer=setTimeout(()=>fail(),taskTimeoutMs);
            try{entry.port.postMessage({type:'fit',runId:id,index:original.index,side});}catch(_){fail();}
          }};
          active=run;
          // Each helper receives the complete photographic evidence once per
          // analysis. sourceHex and frame remain on each reduced side job.
          const frame=analysis.framework||analysis;
          const initialization={type:'init',runId:id,mode,master,sourceInk:sides[0].sourceInk};
          if(mode==='cells'){initialization.master={branches:master.branches};delete initialization.sourceInk;Object.assign(initialization,{canonical:{cells:canonical.cells},options,framework:{center:frame.center,size:frame.size,sourceSize:frame.sourceSize}});}
          try{for(const entry of ports)entry.port.postMessage(initialization);}catch(_){fail();return;}
          for(const entry of ports){if(active!==run)break;run.dispatch(entry);}
        });
      }
      if(results.size!==sides.length)await stopping;
      const accepted=results.size;
      const rows=[];
      for(const side of sides){
        if(mode==='cells'){
          const C=root.ReconstructionCells||(typeof require==='function'?require('./reconstruction-cells.js'):null);
          const prepared=results.get(side.index);
          try{if(prepared)rows.push(C.fitPrepared(prepared.row,prepared.raw,{...options,preparedBase:prepared.base}));
          else {const {row,raw}=C.sideInput(analysis,side,canonical.cells,options);rows.push(C.fitPrepared(row,raw,options));}}catch(error){error.localFitAuthoritative=true;throw error;}
        }else {
          if(!results.has(side.index))results.set(side.index,B.fitSide(analysis.master,side,analysis.master.branches,analysis.master.commonAngle));
          rows.push(results.get(side.index));
        }
      }
      if(mode==='cells')Object.defineProperty(rows,'parallelStats',{value:{attempted,accepted,retried:sides.length-accepted}});
      return rows;
    }
    function enqueue(operation){const result=queue.then(operation);queue=result.catch(()=>{});return result;}
    return {fit(analysis){return enqueue(()=>perform(analysis));},fitCells(analysis,canonical,options={}){return enqueue(()=>perform(analysis,'cells',canonical,options));},attach,fail,dispose(){disposed=true;return fail();}};
  }
  const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.LocalFitPool=api;
})(typeof globalThis!=='undefined'?globalThis:this);
