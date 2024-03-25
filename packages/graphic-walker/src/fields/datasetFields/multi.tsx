import React, { useContext } from 'react';
import { observer } from 'mobx-react-lite';
import { DatasetNamesContext, useVizStore } from '../../store';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IJoinPath } from '@/interfaces';
import { mergePaths, reversePath } from '@/utils/route';
import { Draggable, Droppable } from '@kanaries/react-beautiful-dnd';
import ActionMenu from '@/components/actionMenu';
import { FieldPill } from '../datasetFields/fieldPill';
import { useMenuActions } from '../datasetFields/utils';
import { refMapper } from '../fieldsContext';
import DataTypeIcon from '@/components/dataTypeIcon';
import { EllipsisVerticalIcon } from '@heroicons/react/24/solid';
import { MEA_KEY_ID, MEA_VAL_ID } from '@/constants';
import { deduper } from '@/utils';

const getDiffDesc = (path: IJoinPath, paths: IJoinPath[], fields: { fid: string; dataset?: string; name?: string }[]) => {
    const result: string[] = [];
    if (new Set(paths.map((x) => x.fid)).size > 1) {
        result.push(fields.find((x) => x.fid === path.fid && x.dataset === path.from)?.name ?? path.fid);
    }
    if (new Set(paths.map((x) => x.tid)).size > 1) {
        result.push(fields.find((x) => x.fid === path.tid && x.dataset === path.to)?.name ?? path.tid);
    }
    return result.length > 0 ? `(${result.join(',')})` : '';
};

/**
 * path: the path of this dataset to the base dataset in the view.
 * basePath: the path of base dataset to a logic base dataset.
 * bannedPath: the path that passed.
 * tempBannedPath: the path that just comes from.
 */
const DatasetFields = observer((props: { dataset: string; path: IJoinPath[]; basePath: IJoinPath[]; bannedPath: IJoinPath[]; tempBannedPath: IJoinPath[] }) => {
    const vizStore = useVizStore();
    const { dimensions, measures, routeMap, meta, datasets } = vizStore;
    const bannedPaths = new Set(
        props.bannedPath
            .concat(props.tempBannedPath)
            .filter((x) => x.from === props.dataset)
            .map((x) => `${x.fid}_${x.to}_${x.tid}`)
    );
    const nextPaths = deduper(
        (routeMap[props.dataset] ?? []).filter((x) => !bannedPaths.has(`${x.fid}_${x.to}_${x.tid}`)),
        (p) => p.fid
    ).filter((x) => datasets.includes(x.to));
    const dimMenuActions = useMenuActions('dimensions');
    const meaMenuActions = useMenuActions('measures');
    const joinedPath = mergePaths(props.path.concat(props.basePath));
    const joinedPathId = vizStore.encodeJoinPath(joinedPath);
    const datasetNames = useContext(DatasetNamesContext);
    const tempBannedPaths = nextPaths.map(reversePath);

    return (
        <div>
            <Droppable droppableId={`dimensions_${joinedPathId}_${props.dataset}`}>
                {(provided, snapshot) => (
                    <div {...provided.droppableProps} ref={refMapper(provided.innerRef)}>
                        {dimensions.map((f, index) => {
                            if (f.dataset === props.dataset) {
                                return (
                                    <Draggable key={f.dragId} draggableId={`_${joinedPathId}_${f.dragId}`} index={index}>
                                        {(provided, snapshot) => {
                                            return (
                                                <ActionMenu
                                                    title={f.name || f.fid}
                                                    menu={dimMenuActions[index]}
                                                    enableContextMenu
                                                    disabled={snapshot.isDragging}
                                                >
                                                    <FieldPill
                                                        className={`flex pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-dimension/20 transition-colors rounded-md truncate border border-transparent ${
                                                            snapshot.isDragging ? 'bg-dimension/20' : ''
                                                        }`}
                                                        ref={refMapper(provided.innerRef)}
                                                        isDragging={snapshot.isDragging}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                    >
                                                        <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} />
                                                        <span className="ml-0.5" title={f.name}>
                                                            {f.name}
                                                        </span>
                                                        <ActionMenu.Button as="div">
                                                            <EllipsisVerticalIcon className="w-4 h-4" />
                                                        </ActionMenu.Button>
                                                    </FieldPill>
                                                    {
                                                        <FieldPill
                                                            className={`pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-dimension/20 rounded-full border border-dimension truncate ${
                                                                snapshot.isDragging ? 'bg-dimension/20 flex' : 'hidden'
                                                            }`}
                                                            isDragging={snapshot.isDragging}
                                                        >
                                                            <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} />
                                                            <span className="ml-0.5" title={f.name}>
                                                                {f.name}
                                                            </span>
                                                            <ActionMenu.Button as="div">
                                                                <EllipsisVerticalIcon className="w-4 h-4" />
                                                            </ActionMenu.Button>
                                                        </FieldPill>
                                                    }
                                                </ActionMenu>
                                            );
                                        }}
                                    </Draggable>
                                );
                            }
                            return null;
                        })}
                    </div>
                )}
            </Droppable>
            {/* {dimensions.find((x) => x.dataset === props.dataset) && measures.find((x) => x.dataset === props.dataset) && (
                <div className="w-full h-px bg-border"></div>
            )} */}
            <Droppable droppableId={`measures_${joinedPathId}_${props.dataset}`}>
                {(provided, snapshot) => (
                    <div {...provided.droppableProps} ref={refMapper(provided.innerRef)}>
                        {measures.map((f, index) => {
                            if (f.dataset === props.dataset) {
                                return (
                                    <Draggable key={f.dragId} draggableId={`_${joinedPathId}_${f.dragId}`} index={index}>
                                        {(provided, snapshot) => {
                                            return (
                                                <div className="block">
                                                    <ActionMenu
                                                        title={f.name || f.fid}
                                                        menu={meaMenuActions[index]}
                                                        enableContextMenu
                                                        disabled={snapshot.isDragging || f.fid === MEA_KEY_ID}
                                                    >
                                                        <FieldPill
                                                            className={`flex pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-measure/20 rounded-md truncate border border-transparent ${
                                                                snapshot.isDragging ? 'bg-measure/20' : ''
                                                            }`}
                                                            isDragging={snapshot.isDragging}
                                                            ref={refMapper(provided.innerRef)}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                        >
                                                            <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} />
                                                            <span className="ml-0.5" title={f.name}>
                                                                {f.name}
                                                            </span>
                                                            <ActionMenu.Button as="div">
                                                                <EllipsisVerticalIcon className="w-4 h-4" />
                                                            </ActionMenu.Button>
                                                        </FieldPill>
                                                        {
                                                            <FieldPill
                                                                className={`pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-measure/20 rounded-md border-measure border truncate ${
                                                                    snapshot.isDragging ? 'bg-measure/20 flex' : 'hidden'
                                                                }`}
                                                                isDragging={snapshot.isDragging}
                                                            >
                                                                <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} />
                                                                <span className="ml-0.5" title={f.name}>
                                                                    {f.name}
                                                                </span>
                                                                <ActionMenu.Button as="div">
                                                                    <EllipsisVerticalIcon className="w-4 h-4" />
                                                                </ActionMenu.Button>
                                                            </FieldPill>
                                                        }
                                                    </ActionMenu>
                                                </div>
                                            );
                                        }}
                                    </Draggable>
                                );
                            }
                            return null;
                        })}
                    </div>
                )}
            </Droppable>

            <div className="ml-1">
                {nextPaths.map((p) => (
                    <div key={`${p.from}_${p.fid}_${p.to}_${p.tid}`}>
                        <div className="text-xs text-muted-foreground">
                            {datasetNames?.[p.to] ?? p.to}
                            {getDiffDesc(
                                p,
                                routeMap[props.dataset].filter((x) => x.to === p.to),
                                meta
                            )}
                        </div>
                        <DatasetFields
                            dataset={p.to}
                            basePath={props.basePath}
                            path={[reversePath(p)].concat(props.path)}
                            bannedPath={props.bannedPath.concat([p])}
                            tempBannedPath={tempBannedPaths}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
});

const MultiDatasetFields = observer(() => {
    const vizStore = useVizStore();
    const { baseDataset, datasets, unReachedDatasets, basePath, dimensions, measures } = vizStore;
    const dimMenuActions = useMenuActions('dimensions');
    const meaMenuActions = useMenuActions('measures');
    const datasetNames = useContext(DatasetNamesContext);

    return (
        <div>
            <Tabs value={baseDataset} onValueChange={(d) => vizStore.setViewBaseDataset(d)}>
                <TabsList>
                    {datasets.map((ds) => (
                        <TabsTrigger key={ds} value={ds}>
                            {datasetNames?.[ds] ?? ds}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            <div>
                <DatasetFields bannedPath={[]} basePath={basePath!} dataset={baseDataset} path={[]} tempBannedPath={[]} />
            </div>
            <div className="border-t">
                <Droppable droppableId="dimensions">
                    {(provided, snapshot) => (
                        <div {...provided.droppableProps} ref={refMapper(provided.innerRef)}>
                            {dimensions.map((f, index) => {
                                // TODO add support for fold
                                if (!f.dataset && ![MEA_KEY_ID, MEA_VAL_ID].includes(f.fid)) {
                                    return (
                                        <Draggable key={f.dragId} draggableId={f.dragId} index={index}>
                                            {(provided, snapshot) => {
                                                return (
                                                    <ActionMenu
                                                        title={f.name || f.fid}
                                                        menu={dimMenuActions[index]}
                                                        enableContextMenu
                                                        disabled={snapshot.isDragging}
                                                    >
                                                        <FieldPill
                                                            className={`flex pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-dimension/20 transition-colors rounded-md truncate border border-transparent ${
                                                                snapshot.isDragging ? 'bg-dimension/20' : ''
                                                            }`}
                                                            ref={refMapper(provided.innerRef)}
                                                            isDragging={snapshot.isDragging}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                        >
                                                            <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} />
                                                            <span className="ml-0.5" title={f.name}>
                                                                {f.name}
                                                            </span>
                                                            <ActionMenu.Button as="div">
                                                                <EllipsisVerticalIcon className="w-4 h-4" />
                                                            </ActionMenu.Button>
                                                        </FieldPill>
                                                        {
                                                            <FieldPill
                                                                className={`pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-dimension/20 rounded-full border border-dimension truncate ${
                                                                    snapshot.isDragging ? 'bg-dimension/20 flex' : 'hidden'
                                                                }`}
                                                                isDragging={snapshot.isDragging}
                                                            >
                                                                <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} />
                                                                <span className="ml-0.5" title={f.name}>
                                                                    {f.name}
                                                                </span>
                                                                <ActionMenu.Button as="div">
                                                                    <EllipsisVerticalIcon className="w-4 h-4" />
                                                                </ActionMenu.Button>
                                                            </FieldPill>
                                                        }
                                                    </ActionMenu>
                                                );
                                            }}
                                        </Draggable>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    )}
                </Droppable>
                <Droppable droppableId="measures">
                    {(provided, snapshot) => (
                        <div {...provided.droppableProps} ref={refMapper(provided.innerRef)}>
                            {measures.map((f, index) => {
                                if (!f.dataset && ![MEA_KEY_ID, MEA_VAL_ID].includes(f.fid)) {
                                    return (
                                        <Draggable key={f.dragId} draggableId={f.dragId} index={index}>
                                            {(provided, snapshot) => {
                                                return (
                                                    <div className="block">
                                                        <ActionMenu
                                                            title={f.name || f.fid}
                                                            menu={meaMenuActions[index]}
                                                            enableContextMenu
                                                            disabled={snapshot.isDragging || f.fid === MEA_KEY_ID}
                                                        >
                                                            <FieldPill
                                                                className={`flex pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-measure/20 rounded-md truncate border border-transparent ${
                                                                    snapshot.isDragging ? 'bg-measure/20' : ''
                                                                }`}
                                                                isDragging={snapshot.isDragging}
                                                                ref={refMapper(provided.innerRef)}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                            >
                                                                <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} />
                                                                <span className="ml-0.5" title={f.name}>
                                                                    {f.name}
                                                                </span>
                                                                <ActionMenu.Button as="div">
                                                                    <EllipsisVerticalIcon className="w-4 h-4" />
                                                                </ActionMenu.Button>
                                                            </FieldPill>
                                                            {
                                                                <FieldPill
                                                                    className={`pt-0.5 pb-0.5 pl-2 pr-2 mx-0 m-1 text-xs hover:bg-measure/20 rounded-md border-measure border truncate ${
                                                                        snapshot.isDragging ? 'bg-measure/20 flex' : 'hidden'
                                                                    }`}
                                                                    isDragging={snapshot.isDragging}
                                                                >
                                                                    <DataTypeIcon dataType={f.semanticType} analyticType={f.analyticType} />
                                                                    <span className="ml-0.5" title={f.name}>
                                                                        {f.name}
                                                                    </span>
                                                                    <ActionMenu.Button as="div">
                                                                        <EllipsisVerticalIcon className="w-4 h-4" />
                                                                    </ActionMenu.Button>
                                                                </FieldPill>
                                                            }
                                                        </ActionMenu>
                                                    </div>
                                                );
                                            }}
                                        </Draggable>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    )}
                </Droppable>
            </div>
            {unReachedDatasets.length > 0 && (
                <div>
                    <div className="text-xs text-muted-foreground mb-1">Unlink datasets</div>
                    <ul>
                        {unReachedDatasets.map((ds) => (
                            <li key={ds} className="px-2 py-1 text-xs hover:bg-muted rounded-sm cursor-pointer" onClick={() => vizStore.setLinkingDataset(ds)}>
                                {datasetNames?.[ds] ?? ds}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
});

export default MultiDatasetFields;
