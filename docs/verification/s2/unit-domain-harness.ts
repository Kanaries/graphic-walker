import {createNestedChartFixture} from '../../../packages/graphic-walker/src/lib/native/fixtures';
import {adaptChartToRenderPlan} from '../../../packages/graphic-walker/src/lib/native/adapter';
import {createPreparedDataSource} from '../../../packages/worksheet-renderer/src/core/prepared';
import {createWorksheet} from '../../../packages/worksheet-renderer/src/runtime/worksheet';
const f=createNestedChartFixture();const columns=f.columns.map(c=>c.columnKey==='Profit_sum'?{...c,unitKey:'percent'}:c);const plan=adaptChartToRenderPlan(f.chart,{columns}).plan!;const source=createPreparedDataSource({plan,records:f.records,version:{sourceId:'unit-fixture',snapshotId:'1',presentationId:'1'},getDatumKey:f.getDatumKey});const view=createWorksheet(document.querySelector('#host')!,{plan,source,backend:'svg'},{width:1200,height:720,autoResize:false});(window as any).units={view,plan};
