import {createWorksheet} from '../../../packages/worksheet-renderer/src/runtime/worksheet';
import {createB4Plan} from '../../../packages/worksheet-renderer/bench/fixtures';
import {createB4Source} from '../../../packages/worksheet-renderer/bench/programmatic';
const host=document.querySelector('#host') as HTMLElement;
let view: ReturnType<typeof createWorksheet>;
(window as any).testMixed=async (rows:number,columns:number,backend:'canvas'|'svg')=>{view?.dispose();let plan=createB4Plan(),source=createB4Source(plan,{rowCount:rows,columnCount:columns});view=createWorksheet(host,{plan,source,backend},{autoResize:false,width:1000,height:600,dpr:2,accessibleName:'B4 mixed'});await view.ready;return view.getViewState()};
(window as any).testView=()=>view;
