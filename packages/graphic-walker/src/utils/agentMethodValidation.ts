import { IAggregator, ISemanticType, ICoordMode, AgentMethodRequest, AgentMethodError } from '../interfaces';
import { Methods, PropsMap } from '../models/visSpecHistory';
import { DATE_TIME_DRILL_LEVELS, DATE_TIME_FEATURE_LEVELS } from '../constants';

// Valid values for various enums
const VALID_AGGREGATORS: ReadonlySet<IAggregator> = new Set<IAggregator>([
    'sum',
    'count',
    'max',
    'min',
    'mean',
    'median',
    'variance',
    'stdev',
    'distinctCount',
    'expr',
]);

const VALID_SEMANTIC_TYPES: ReadonlySet<ISemanticType> = new Set<ISemanticType>([
    'quantitative',
    'nominal',
    'ordinal',
    'temporal',
]);

const VALID_COORD_SYSTEMS: ReadonlySet<ICoordMode> = new Set<ICoordMode>([
    'generic',
    'geographic',
]);

const VALID_BINLOG_OPS: ReadonlySet<string> = new Set([
    'bin',
    'binCount',
    'log10',
    'log2',
    'log',
]);

const VALID_SORT_MODES: ReadonlySet<string> = new Set([
    'ascending',
    'descending',
    'none',
]);

const CLONE_FIELD_SOURCE_CHANNELS = ['dimensions', 'measures'] as const;
const CLONE_FIELD_DEST_CHANNELS = [
    'rows',
    'columns',
    'color',
    'opacity',
    'size',
    'shape',
    'theta',
    'radius',
    'longitude',
    'latitude',
    'geoId',
    'details',
    'text',
    'tooltip',
] as const;
const CLONE_FIELD_SOURCE_SET = new Set<string>(CLONE_FIELD_SOURCE_CHANNELS);
const CLONE_FIELD_DEST_SET = new Set<string>(CLONE_FIELD_DEST_CHANNELS);

const NORMAL_CHANNELS = [
    'dimensions',
    'measures',
    'rows',
    'columns',
    'color',
    'opacity',
    'size',
    'shape',
    'theta',
    'radius',
    'longitude',
    'latitude',
    'geoId',
    'details',
    'text',
    'tooltip',
] as const;
const NORMAL_CHANNEL_SET = new Set<string>(NORMAL_CHANNELS);

const ALL_CHANNELS = [...NORMAL_CHANNELS, 'filters'] as const;
const ALL_CHANNEL_SET = new Set<string>(ALL_CHANNELS);

const VALID_DATE_TIME_DRILL_LEVELS = new Set(DATE_TIME_DRILL_LEVELS);
const VALID_DATE_TIME_FEATURE_LEVELS = new Set(DATE_TIME_FEATURE_LEVELS);

/**
 * Validates agent method requests with comprehensive type checking
 */
export function validateAgentMethod(request: AgentMethodRequest<any>): AgentMethodError | null {
    const { method, args: rawArgs } = request;
    const args = rawArgs as any[]; // Cast to any[] for validation purposes

    try {
        switch (method) {
            case 'setConfig': {
                if (args.length < 2) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `setConfig requires 2 arguments: [key, value], but got ${args.length} arguments`,
                    };
                }
                const [key, value] = args as PropsMap[Methods.setConfig];
                if (typeof key !== 'string') {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `setConfig: key must be a string, got ${typeof key}`,
                    };
                }
                break;
            }

            case 'removeField': {
                if (args.length < 2) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `removeField requires 2 arguments: [channel, index], but got ${args.length} arguments`,
                    };
                }
                const [channel, index] = args as PropsMap[Methods.removeField];
                if (typeof channel !== 'string' || !ALL_CHANNEL_SET.has(channel)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `removeField: invalid channel "${channel}". Must be one of: ${Array.from(ALL_CHANNEL_SET).join(', ')}`,
                    };
                }
                if (typeof index !== 'number' || index < 0 || !Number.isInteger(index)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `removeField: index must be a non-negative integer, got ${index}`,
                    };
                }
                break;
            }

            case 'reorderField': {
                if (args.length < 3) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `reorderField requires 3 arguments: [channel, fromIndex, toIndex], but got ${args.length} arguments`,
                    };
                }
                const [channel, fromIndex, toIndex] = args as PropsMap[Methods.reorderField];
                if (typeof channel !== 'string' || !ALL_CHANNEL_SET.has(channel)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `reorderField: invalid channel "${channel}". Must be one of: ${Array.from(ALL_CHANNEL_SET).join(', ')}`,
                    };
                }
                if (typeof fromIndex !== 'number' || fromIndex < 0 || !Number.isInteger(fromIndex)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `reorderField: fromIndex must be a non-negative integer, got ${fromIndex}`,
                    };
                }
                if (typeof toIndex !== 'number' || toIndex < 0 || !Number.isInteger(toIndex)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `reorderField: toIndex must be a non-negative integer, got ${toIndex}`,
                    };
                }
                break;
            }

            case 'moveField': {
                if (args.length < 4) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `moveField requires at least 4 arguments: [fromChannel, fromIndex, toChannel, toIndex, limit?], but got ${args.length} arguments`,
                    };
                }
                const [fromChannel, fromIndex, toChannel, toIndex, limit] = args as PropsMap[Methods.moveField];
                if (typeof fromChannel !== 'string' || !NORMAL_CHANNEL_SET.has(fromChannel)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `moveField: invalid fromChannel "${fromChannel}". Must be one of: ${Array.from(NORMAL_CHANNEL_SET).join(', ')}`,
                    };
                }
                if (typeof toChannel !== 'string' || !NORMAL_CHANNEL_SET.has(toChannel)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `moveField: invalid toChannel "${toChannel}". Must be one of: ${Array.from(NORMAL_CHANNEL_SET).join(', ')}`,
                    };
                }
                if (typeof fromIndex !== 'number' || fromIndex < 0 || !Number.isInteger(fromIndex)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `moveField: fromIndex must be a non-negative integer, got ${fromIndex}`,
                    };
                }
                if (typeof toIndex !== 'number' || toIndex < 0 || !Number.isInteger(toIndex)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `moveField: toIndex must be a non-negative integer, got ${toIndex}`,
                    };
                }
                if (limit !== null && limit !== undefined) {
                    if (typeof limit !== 'number' || limit <= 0 || !Number.isInteger(limit)) {
                        return {
                            code: 'ERR_EXECUTION_FAILED',
                            message: `moveField: limit must be a positive integer or null, got ${limit}`,
                        };
                    }
                }
                break;
            }

            case 'cloneField': {
                if (args.length < 5) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `cloneField requires at least 5 arguments: [sourceChannel, sourceIndex, destChannel, destIndex, newFieldKey, limit?], but got ${args.length} arguments`,
                    };
                }
                const [sourceChannel, sourceIndex, destChannel, destIndex, newFieldKey, limit] = args as PropsMap[Methods.cloneField];
                if (typeof sourceChannel !== 'string' || !CLONE_FIELD_SOURCE_SET.has(sourceChannel)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `cloneField: invalid sourceChannel "${sourceChannel}". Must be one of: ${Array.from(CLONE_FIELD_SOURCE_SET).join(', ')}`,
                    };
                }
                if (typeof destChannel !== 'string' || !CLONE_FIELD_DEST_SET.has(destChannel)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `cloneField: invalid destChannel "${destChannel}". Must be one of: ${Array.from(CLONE_FIELD_DEST_SET).join(', ')}`,
                    };
                }
                if (typeof sourceIndex !== 'number' || sourceIndex < 0 || !Number.isInteger(sourceIndex)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `cloneField: sourceIndex must be a non-negative integer, got ${sourceIndex}`,
                    };
                }
                if (typeof destIndex !== 'number' || destIndex < 0 || !Number.isInteger(destIndex)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `cloneField: destIndex must be a non-negative integer, got ${destIndex}`,
                    };
                }
                if (typeof newFieldKey !== 'string') {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `cloneField: newFieldKey must be a string, got ${typeof newFieldKey}`,
                    };
                }
                if (limit !== null && limit !== undefined) {
                    if (typeof limit !== 'number' || limit <= 0 || !Number.isInteger(limit)) {
                        return {
                            code: 'ERR_EXECUTION_FAILED',
                            message: `cloneField: limit must be a positive integer or null, got ${limit}`,
                        };
                    }
                }
                break;
            }

            case 'setFieldAggregator': {
                if (args.length < 3) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `setFieldAggregator requires 3 arguments: [channel, index, aggregator], but got ${args.length} arguments`,
                    };
                }
                const [channel, index, aggregator] = args as PropsMap[Methods.setFieldAggregator];
                if (typeof channel !== 'string' || !NORMAL_CHANNEL_SET.has(channel)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `setFieldAggregator: invalid channel "${channel}". Must be one of: ${Array.from(NORMAL_CHANNEL_SET).join(', ')}`,
                    };
                }
                if (typeof index !== 'number' || index < 0 || !Number.isInteger(index)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `setFieldAggregator: index must be a non-negative integer, got ${index}`,
                    };
                }
                if (typeof aggregator !== 'string' || !VALID_AGGREGATORS.has(aggregator as IAggregator)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `setFieldAggregator: invalid aggregator "${aggregator}". Must be one of: ${Array.from(VALID_AGGREGATORS).join(', ')}`,
                    };
                }
                break;
            }

            case 'changeSemanticType': {
                if (args.length < 3) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `changeSemanticType requires 3 arguments: [channel, index, semanticType], but got ${args.length} arguments`,
                    };
                }
                const [channel, index, semanticType] = args as PropsMap[Methods.changeSemanticType];
                if (typeof channel !== 'string' || !NORMAL_CHANNEL_SET.has(channel)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `changeSemanticType: invalid channel "${channel}". Must be one of: ${Array.from(NORMAL_CHANNEL_SET).join(', ')}`,
                    };
                }
                if (typeof index !== 'number' || index < 0 || !Number.isInteger(index)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `changeSemanticType: index must be a non-negative integer, got ${index}`,
                    };
                }
                if (typeof semanticType !== 'string' || !VALID_SEMANTIC_TYPES.has(semanticType as ISemanticType)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `changeSemanticType: invalid semanticType "${semanticType}". Must be one of: ${Array.from(VALID_SEMANTIC_TYPES).join(', ')}`,
                    };
                }
                break;
            }

            case 'createBinlogField': {
                if (args.length < 5) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `createBinlogField requires 5 arguments: [channel, index, op, newFieldKey, num], but got ${args.length} arguments`,
                    };
                }
                const [channel, index, op, newFieldKey, num] = args as PropsMap[Methods.createBinlogField];
                if (typeof channel !== 'string' || !NORMAL_CHANNEL_SET.has(channel)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `createBinlogField: invalid channel "${channel}". Must be one of: ${Array.from(NORMAL_CHANNEL_SET).join(', ')}`,
                    };
                }
                if (typeof index !== 'number' || index < 0 || !Number.isInteger(index)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `createBinlogField: index must be a non-negative integer, got ${index}`,
                    };
                }
                if (typeof op !== 'string' || !VALID_BINLOG_OPS.has(op)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `createBinlogField: invalid op "${op}". Must be one of: ${Array.from(VALID_BINLOG_OPS).join(', ')}`,
                    };
                }
                if (typeof newFieldKey !== 'string') {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `createBinlogField: newFieldKey must be a string, got ${typeof newFieldKey}`,
                    };
                }
                if (typeof num !== 'number' || num <= 0) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `createBinlogField: num must be a positive number, got ${num}`,
                    };
                }
                break;
            }

            case 'appendFilter': {
                if (args.length < 3) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `appendFilter requires at least 3 arguments: [index, sourceChannel, sourceIndex, dragId?], but got ${args.length} arguments`,
                    };
                }
                const [index, sourceChannel, sourceIndex] = args as PropsMap[Methods.appendFilter];
                if (typeof index !== 'number' || index < 0 || !Number.isInteger(index)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `appendFilter: index must be a non-negative integer, got ${index}`,
                    };
                }
                if (typeof sourceChannel !== 'string' || !NORMAL_CHANNEL_SET.has(sourceChannel)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `appendFilter: invalid sourceChannel "${sourceChannel}". Must be one of: ${Array.from(NORMAL_CHANNEL_SET).join(', ')}`,
                    };
                }
                if (typeof sourceIndex !== 'number' || sourceIndex < 0 || !Number.isInteger(sourceIndex)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `appendFilter: sourceIndex must be a non-negative integer, got ${sourceIndex}`,
                    };
                }
                break;
            }

            case 'modFilter': {
                if (args.length < 3) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `modFilter requires 3 arguments: [index, sourceChannel, sourceIndex], but got ${args.length} arguments`,
                    };
                }
                const [index, sourceChannel, sourceIndex] = args as PropsMap[Methods.modFilter];
                if (typeof index !== 'number' || index < 0 || !Number.isInteger(index)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `modFilter: index must be a non-negative integer, got ${index}`,
                    };
                }
                if (typeof sourceChannel !== 'string' || !NORMAL_CHANNEL_SET.has(sourceChannel)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `modFilter: invalid sourceChannel "${sourceChannel}". Must be one of: ${Array.from(NORMAL_CHANNEL_SET).join(', ')}`,
                    };
                }
                if (typeof sourceIndex !== 'number' || sourceIndex < 0 || !Number.isInteger(sourceIndex)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `modFilter: sourceIndex must be a non-negative integer, got ${sourceIndex}`,
                    };
                }
                break;
            }

            case 'writeFilter': {
                if (args.length < 2) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `writeFilter requires 2 arguments: [index, rule], but got ${args.length} arguments`,
                    };
                }
                const [index, rule] = args as PropsMap[Methods.writeFilter];
                if (typeof index !== 'number' || index < 0 || !Number.isInteger(index)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `writeFilter: index must be a non-negative integer, got ${index}`,
                    };
                }
                // rule can be null or an object, allow both
                break;
            }

            case 'setName': {
                if (args.length < 1) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `setName requires 1 argument: [name], but got ${args.length} arguments`,
                    };
                }
                const [name] = args as PropsMap[Methods.setName];
                if (typeof name !== 'string') {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `setName: name must be a string, got ${typeof name}`,
                    };
                }
                break;
            }

            case 'applySort': {
                if (args.length < 1) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `applySort requires 1 argument: [sortMode], but got ${args.length} arguments`,
                    };
                }
                const [sortMode] = args as PropsMap[Methods.applySort];
                if (typeof sortMode !== 'string' || !VALID_SORT_MODES.has(sortMode)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `applySort: invalid sortMode "${sortMode}". Must be one of: ${Array.from(VALID_SORT_MODES).join(', ')}`,
                    };
                }
                break;
            }

            case 'transpose': {
                // No arguments required
                break;
            }

            case 'setLayout': {
                if (args.length < 1) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `setLayout requires 1 argument: [kvPairs], but got ${args.length} arguments`,
                    };
                }
                const [kvPairs] = args as PropsMap[Methods.setLayout];
                if (!Array.isArray(kvPairs)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `setLayout: kvPairs must be an array of [key, value] tuples, got ${typeof kvPairs}`,
                    };
                }
                break;
            }

            case 'setGeoData': {
                if (args.length < 3) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `setGeoData requires 3 arguments: [geojson, geoKey, geoUrl], but got ${args.length} arguments`,
                    };
                }
                // GeoJSON validation is complex, skip detailed validation
                break;
            }

            case 'setCoordSystem': {
                if (args.length < 1) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `setCoordSystem requires 1 argument: [coordSystem], but got ${args.length} arguments`,
                    };
                }
                const [coordSystem] = args as PropsMap[Methods.setCoordSystem];
                if (typeof coordSystem !== 'string' || !VALID_COORD_SYSTEMS.has(coordSystem as ICoordMode)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `setCoordSystem: invalid coordSystem "${coordSystem}". Must be one of: ${Array.from(VALID_COORD_SYSTEMS).join(', ')}`,
                    };
                }
                break;
            }

            case 'createDateDrillField': {
                if (args.length < 5) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `createDateDrillField requires at least 5 arguments: [channel, index, drillLevel, newFieldKey, newName, format?, offset?], but got ${args.length} arguments`,
                    };
                }
                const [channel, index, drillLevel, newFieldKey, newName] = args as PropsMap[Methods.createDateDrillField];
                if (typeof channel !== 'string' || !NORMAL_CHANNEL_SET.has(channel)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `createDateDrillField: invalid channel "${channel}". Must be one of: ${Array.from(NORMAL_CHANNEL_SET).join(', ')}`,
                    };
                }
                if (typeof index !== 'number' || index < 0 || !Number.isInteger(index)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `createDateDrillField: index must be a non-negative integer, got ${index}`,
                    };
                }
                if (typeof drillLevel !== 'string' || !VALID_DATE_TIME_DRILL_LEVELS.has(drillLevel)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `createDateDrillField: invalid drillLevel "${drillLevel}". Must be one of: ${Array.from(VALID_DATE_TIME_DRILL_LEVELS).join(', ')}`,
                    };
                }
                if (typeof newFieldKey !== 'string') {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `createDateDrillField: newFieldKey must be a string, got ${typeof newFieldKey}`,
                    };
                }
                if (typeof newName !== 'string') {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `createDateDrillField: newName must be a string, got ${typeof newName}`,
                    };
                }
                break;
            }

            case 'createDateFeatureField': {
                if (args.length < 5) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `createDateFeatureField requires at least 5 arguments: [channel, index, featureLevel, newFieldKey, newName, format?, offset?], but got ${args.length} arguments`,
                    };
                }
                const [channel, index, featureLevel, newFieldKey, newName] = args as PropsMap[Methods.createDateFeatureField];
                if (typeof channel !== 'string' || !NORMAL_CHANNEL_SET.has(channel)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `createDateFeatureField: invalid channel "${channel}". Must be one of: ${Array.from(NORMAL_CHANNEL_SET).join(', ')}`,
                    };
                }
                if (typeof index !== 'number' || index < 0 || !Number.isInteger(index)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `createDateFeatureField: index must be a non-negative integer, got ${index}`,
                    };
                }
                if (typeof featureLevel !== 'string' || !VALID_DATE_TIME_FEATURE_LEVELS.has(featureLevel)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `createDateFeatureField: invalid featureLevel "${featureLevel}". Must be one of: ${Array.from(VALID_DATE_TIME_FEATURE_LEVELS).join(', ')}`,
                    };
                }
                if (typeof newFieldKey !== 'string') {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `createDateFeatureField: newFieldKey must be a string, got ${typeof newFieldKey}`,
                    };
                }
                if (typeof newName !== 'string') {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `createDateFeatureField: newName must be a string, got ${typeof newName}`,
                    };
                }
                break;
            }

            case 'setFilterAggregator': {
                if (args.length < 2) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `setFilterAggregator requires 2 arguments: [index, aggregator], but got ${args.length} arguments`,
                    };
                }
                const [index, aggregator] = args as PropsMap[Methods.setFilterAggregator];
                if (typeof index !== 'number' || index < 0 || !Number.isInteger(index)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `setFilterAggregator: index must be a non-negative integer, got ${index}`,
                    };
                }
                if (aggregator !== '' && (typeof aggregator !== 'string' || !VALID_AGGREGATORS.has(aggregator as IAggregator))) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `setFilterAggregator: invalid aggregator "${aggregator}". Must be one of: ${Array.from(VALID_AGGREGATORS).join(', ')} or empty string`,
                    };
                }
                break;
            }

            case 'addFoldField': {
                if (args.length < 5) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `addFoldField requires at least 5 arguments: [fromChannel, fromIndex, toChannel, toIndex, newFieldKey, limit?], but got ${args.length} arguments`,
                    };
                }
                const [fromChannel, fromIndex, toChannel, toIndex, newFieldKey, limit] = args as PropsMap[Methods.addFoldField];
                if (typeof fromChannel !== 'string' || !NORMAL_CHANNEL_SET.has(fromChannel)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `addFoldField: invalid fromChannel "${fromChannel}". Must be one of: ${Array.from(NORMAL_CHANNEL_SET).join(', ')}`,
                    };
                }
                if (typeof toChannel !== 'string' || !NORMAL_CHANNEL_SET.has(toChannel)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `addFoldField: invalid toChannel "${toChannel}". Must be one of: ${Array.from(NORMAL_CHANNEL_SET).join(', ')}`,
                    };
                }
                if (typeof fromIndex !== 'number' || fromIndex < 0 || !Number.isInteger(fromIndex)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `addFoldField: fromIndex must be a non-negative integer, got ${fromIndex}`,
                    };
                }
                if (typeof toIndex !== 'number' || toIndex < 0 || !Number.isInteger(toIndex)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `addFoldField: toIndex must be a non-negative integer, got ${toIndex}`,
                    };
                }
                if (typeof newFieldKey !== 'string') {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `addFoldField: newFieldKey must be a string, got ${typeof newFieldKey}`,
                    };
                }
                if (limit !== null && limit !== undefined) {
                    if (typeof limit !== 'number' || limit <= 0 || !Number.isInteger(limit)) {
                        return {
                            code: 'ERR_EXECUTION_FAILED',
                            message: `addFoldField: limit must be a positive integer or null, got ${limit}`,
                        };
                    }
                }
                break;
            }

            case 'upsertPaintField': {
                if (args.length < 2) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `upsertPaintField requires 2 arguments: [paintMap, name], but got ${args.length} arguments`,
                    };
                }
                const [paintMap, name] = args as PropsMap[Methods.upsertPaintField];
                // paintMap can be null or an object
                if (typeof name !== 'string') {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `upsertPaintField: name must be a string, got ${typeof name}`,
                    };
                }
                break;
            }

            case 'addSQLComputedField': {
                if (args.length < 3) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `addSQLComputedField requires 3 arguments: [fid, name, sql], but got ${args.length} arguments`,
                    };
                }
                const [fid, name, sql] = args as PropsMap[Methods.addSQLComputedField];
                if (typeof fid !== 'string') {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `addSQLComputedField: fid must be a string, got ${typeof fid}`,
                    };
                }
                if (typeof name !== 'string') {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `addSQLComputedField: name must be a string, got ${typeof name}`,
                    };
                }
                if (typeof sql !== 'string') {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `addSQLComputedField: sql must be a string, got ${typeof sql}`,
                    };
                }
                break;
            }

            case 'removeAllField': {
                if (args.length < 1) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `removeAllField requires 1 argument: [fid], but got ${args.length} arguments`,
                    };
                }
                const [fid] = args as PropsMap[Methods.removeAllField];
                if (typeof fid !== 'string') {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `removeAllField: fid must be a string, got ${typeof fid}`,
                    };
                }
                break;
            }

            case 'editAllField': {
                if (args.length < 2) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `editAllField requires 2 arguments: [fid, newData], but got ${args.length} arguments`,
                    };
                }
                const [fid, newData] = args as PropsMap[Methods.editAllField];
                if (typeof fid !== 'string') {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `editAllField: fid must be a string, got ${typeof fid}`,
                    };
                }
                if (typeof newData !== 'object' || newData === null || Array.isArray(newData)) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `editAllField: newData must be an object, got ${typeof newData}`,
                    };
                }
                break;
            }

            case 'replaceWithNLPQuery': {
                if (args.length < 2) {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `replaceWithNLPQuery requires 2 arguments: [query, response], but got ${args.length} arguments`,
                    };
                }
                const [query, response] = args as PropsMap[Methods.replaceWithNLPQuery];
                if (typeof query !== 'string') {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `replaceWithNLPQuery: query must be a string, got ${typeof query}`,
                    };
                }
                if (typeof response !== 'string') {
                    return {
                        code: 'ERR_EXECUTION_FAILED',
                        message: `replaceWithNLPQuery: response must be a string, got ${typeof response}`,
                    };
                }
                break;
            }

            default: {
                return {
                    code: 'ERR_UNKNOWN_METHOD',
                    message: `Unknown method: ${method}`,
                };
            }
        }
    } catch (error) {
        return {
            code: 'ERR_EXECUTION_FAILED',
            message: `Validation error: ${(error as Error).message}`,
        };
    }

    return null;
}
