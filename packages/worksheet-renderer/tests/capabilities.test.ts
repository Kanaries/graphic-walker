import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertS0Capabilities } from '../src/core/capabilities';
import { adaptChartToRenderPlan } from '../../graphic-walker/src/lib/native/adapter';
import { createNestedChartFixture } from '../../graphic-walker/src/lib/native/fixtures';
const fixture=createNestedChartFixture();
const plan=adaptChartToRenderPlan(fixture.chart,{columns:fixture.columns}).plan!;
test('independent library rejects unsupported options instead of silently dropping them',()=>{
    assert.doesNotThrow(()=>assertS0Capabilities(plan));
    for(const change of [{style:{pointSize:10}},{axes:{[plan.rows.positions[0]]:{hidden:true}}},{channels:{size:{value:10}}},{scales:{[plan.rows.positions[0]]:{scope:{mode:'pane' as const}}}}]){
        assert.throws(()=>assertS0Capabilities({...plan,...change}),/unsupported-encoding/);
    }
});
