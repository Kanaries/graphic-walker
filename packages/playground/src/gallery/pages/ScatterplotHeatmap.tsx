import ExampleWrapper from '../components/Example';
import GalleryGroup, { IGalleryItem } from '../components/GalleryGroup';
import { toRouterPath } from '../util';

const groupItems: IGalleryItem[] = [
    {
        name: "bike-sharing-service-circle",
        title: "Compare the Seasonal Changes of Casual and Registered Users for a Bike Sharing Service",
        datasetName: "ds-bikesharing-service",
    },
    {
        name: "students-service-heatmap",
        title: "Monitor Students' Performance in Reading and Writing",
        datasetName: "ds-students-service",
    },
    {
        name: "college-service-scatterplot",
        title: "How State Funding Model Affects U.S. Colleges",
        datasetName: "ds-collage-service",
    }
];

const name = "Scatterplot, Heatmap";
const path = toRouterPath(name);
const pages = groupItems.map((item) => ({
    name: item.name,
    path: toRouterPath(item.name),
    element: <ExampleWrapper options={item}/>,
}));

export default {
    name,
    path,
    element: <GalleryGroup title={name} path={path} items={groupItems}/>,
    children: pages,
};
