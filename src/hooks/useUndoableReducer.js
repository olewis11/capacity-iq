const {useState,useCallback}=React;

const DATA_ACTIONS=new Set([
  'ADD_ASSIGNMENT','REMOVE_ASSIGNMENT','EXTEND_ASSIGNMENT','UPDATE_ASSIGNMENT',
  'UPDATE_PROJECT','ADD_PROJECT','DELETE_PROJECT','REORDER_PROJECTS','IMPORT_DATA',
  'DELETE_ENGINEER','UPDATE_ENGINEER','REPARENT_DISC','MERGE_IMPORT',
  // NOTE: LOAD_STATE is intentionally excluded — it's used for store/snapshot loads
  // and should not push history (otherwise first undo wipes all data).
]);

export function useUndoableReducer(reducerFn,initialState,maxHistory=50){
  const[history,setHistory]=useState({past:[],present:initialState,future:[]});
  const dispatch=useCallback((action)=>{
    setHistory(({past,present,future})=>{
      const next=reducerFn(present,action);
      if(!DATA_ACTIONS.has(action.type))return{past,present:next,future};
      return{past:[...past.slice(-(maxHistory-1)),present],present:next,future:[]};
    });
  },[reducerFn]);
  const undo=useCallback(()=>{
    setHistory(({past,present,future})=>{
      if(!past.length)return{past,present,future};
      const prev=past[past.length-1];
      return{past:past.slice(0,-1),present:prev,future:[present,...future].slice(0,maxHistory)};
    });
  },[]);
  const redo=useCallback(()=>{
    setHistory(({past,present,future})=>{
      if(!future.length)return{past,present,future};
      const[next,...rest]=future;
      return{past:[...past,present].slice(-maxHistory),present:next,future:rest};
    });
  },[]);
  return[history.present,dispatch,undo,redo,history.past.length>0,history.future.length>0];
}
