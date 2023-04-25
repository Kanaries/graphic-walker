import React from 'react';
import { INestNode } from './inteface';

export interface TreeProps {
    data: INestNode;
}
const TopTree: React.FC<TreeProps> = (props) => {
    return <div>{JSON.stringify(props.data)}</div>;
};

export default TopTree;
