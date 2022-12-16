import React, { useState, useEffect, useRef } from 'react';
import { Specification } from 'visual-insights';
import { observer } from 'mobx-react-lite';
import { LightBulbIcon } from '@heroicons/react/24/outline'
import { toJS } from 'mobx';
import { useTranslation } from 'react-i18next';
import { IMutField, IRow } from './interfaces';
import type { IReactVegaHandler } from './vis/react-vega';
import VisualSettings from './visualSettings';
import { Container, NestContainer } from './components/container';
import ClickMenu from './components/clickMenu';
import InsightBoard from './insightBoard/index';
import PosFields from './fields/posFields';
import AestheticFields from './fields/aestheticFields';
import DatasetFields from './fields/datasetFields/index';
import ReactiveRenderer from './renderer/index';
import DataSourceSegment from './dataSource/index';
import { useGlobalStore } from './store';
import { preAnalysis, destroyWorker } from './services'
import VisNav from './segments/visNav';
import { mergeLocaleRes, setLocaleLanguage } from './locales/i18n';
import Menubar from './visualSettings/menubar';
import FilterField from './fields/filterField';
import "tailwindcss/tailwind.css"
import './index.css'


export interface EditorProps {
	dataSource?: IRow[];
	rawFields?: IMutField[];
	spec?: Specification;
	hideDataSourceConfig?: boolean;
	i18nLang?: string;
	i18nResources?: { [lang: string]: Record<string, string | any> };
	keepAlive?: boolean;
}

const App: React.FC<EditorProps> = props => {
	const { dataSource = [], rawFields = [], spec, i18nLang = 'en-US', i18nResources, hideDataSourceConfig } = props;
	const { commonStore, vizStore } = useGlobalStore();
	const [insightReady, setInsightReady] = useState<boolean>(true);

	const { currentDataset, datasets, vizEmbededMenu } = commonStore;

	const { t, i18n } = useTranslation();
	const curLang = i18n.language;

	useEffect(() => {
		if (i18nResources) {
			mergeLocaleRes(i18nResources);
		}
	}, [i18nResources]);

	useEffect(() => {
		if (i18nLang !== curLang) {
			setLocaleLanguage(i18nLang);
		}
	}, [i18nLang, curLang]);

	// use as an embeding module, use outside datasource from props.
	useEffect(() => {
		if (dataSource.length > 0) {
			commonStore.addAndUseDS({
				name: 'context dataset',
				dataSource: dataSource,
				rawFields
			})
		}
	}, [dataSource, rawFields])

	// do preparation analysis work when using a new dataset
	useEffect(() => {
		const ds = currentDataset;
		if (ds && ds.dataSource.length > 0 && ds.rawFields.length > 0) {
			setInsightReady(false)
			preAnalysis({
				dataSource: ds.dataSource,
				fields: toJS(ds.rawFields)
			}).then(() => {
				setInsightReady(true);

				if (spec) {
					vizStore.renderSpec(spec);
				}
			})
		}
		return () => {
			destroyWorker();
		}
	}, [currentDataset, spec]);

	const rendererRef = useRef<IReactVegaHandler>(null);

	return (
		<div className="App">
			{ !hideDataSourceConfig && <DataSourceSegment preWorkDone={insightReady} />}
			<div className='px-2 mx-2'>
				<VisNav />
				{/* <PureTabs tabs={[{label: 'a', key: 'a'}, {label: 'b', key: 'b'}]} selectedKey='a' onSelected={() => {}} /> */}
			</div>
			<Container style={{ marginTop: '0em', borderTop: 'none' }}>
				<Menubar />
				<VisualSettings rendererHandler={rendererRef} />
				<div className="md:grid md:grid-cols-12 xl:grid-cols-6">
					<div className="md:col-span-3 xl:col-span-1">
						<DatasetFields />
					</div>
					<div className="md:col-span-2 xl:col-span-1">
						<FilterField />
						<AestheticFields />
					</div>
					<div className="md:col-span-7 xl:col-span-4">
						<div>
							<PosFields />
						</div>
						<NestContainer style={{ minHeight: '600px', overflow: 'auto' }} onMouseLeave={() => {
							vizEmbededMenu.show && commonStore.closeEmbededMenu();
						}}>
							{datasets.length > 0 && <ReactiveRenderer ref={rendererRef} />}
							<InsightBoard />
							{vizEmbededMenu.show && (
								<ClickMenu x={vizEmbededMenu.position[0]} y={vizEmbededMenu.position[1]}>
									<div className="flex items-center whitespace-nowrap py-1 px-4 hover:bg-gray-100"
										onClick={() => {
											commonStore.closeEmbededMenu();
											commonStore.setShowInsightBoard(true)
										}}
									>
										<span className="flex-1 pr-2">
											{t('App.labels.data_interpretation')}
										</span>
										<LightBulbIcon className="ml-1 w-3 flex-grow-0 flex-shrink-0" />
									</div>
								</ClickMenu>
							)}
						</NestContainer>
					</div>
				</div>
			</Container>
		</div>
	)
}

export default observer(App);
