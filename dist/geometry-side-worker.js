/* A helper owns no persistent image model. All geometry remains browser-local. */
'use strict';
importScripts('engine.js','vendor/earcut.min.js','vendor/polygon-clipping.min.js','reconstruction-branches.js','reconstruction-partition.js','reconstruction-cells.js');
self.onmessage=event=>{
  const data=event.data||{},port=data.port||(event.ports&&event.ports[0]);
  if(!port)return;
  let current=null;
  port.onmessage=message=>{
    const job=message.data||{};
    if(job.type==='init'){current=job;return;}
    if(job.type!=='fit')return;
    try{
      if(!current||current.runId!==job.runId)throw new Error('Local fit analysis is not initialized');
      const side={...job.side,sourceInk:current.sourceInk},master=current.master;
      let fit;
      if(current.mode==='cells'){
        fit=ReconstructionCells.prepareSide({framework:current.framework,master},side,current.canonical.cells,current.options);
      }else fit=ReconstructionBranches.fitSide(master,side,master.branches,master.commonAngle);
      port.postMessage({type:'fit',runId:job.runId,index:job.index,fit});
    }catch(error){port.postMessage({type:'error',runId:job.runId,index:job.index,error:error.message||String(error)});}
  };
  if(port.start)port.start();
};
