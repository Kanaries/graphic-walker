import BikeSharingServiceCircle from '../imgs/bike-sharing-service-circle.png';
import StudentsServiceHeatmap from '../imgs/students-service-heatmap.png';
import CollegeScatterplot from '../imgs/college-service-scatterplot.png';
import ExampleWrapper from '../components/Example';
import GalleryGroup, { IGalleryItem } from '../components/GalleryGroup';
import { toRouterPath } from '../util';

const groupItems: IGalleryItem[] = [
    {
        name: "bike-sharing-service",
        title: "Compare the Seasonal Changes of Casual and Registered Users for a Bike Sharing Service",
        imageURL: BikeSharingServiceCircle,
        datasetName: "ds-bike-sharing-service",
        specName: "bike-sharing-service-circle",
    },
    {
        name: "student-service",
        title: "Monitor Students' Performance in Reading and Writing",
        imageURL: StudentsServiceHeatmap,
        datasetName: "ds-students-service",
        specName: "students-service-heatmap",
    },
    {
        name: "college",
        title: "How State Funding Model Affects U.S. Colleges",
        imageURL: CollegeScatterplot,
        datasetName: "ds-college-service",
        specName: "college-service-scatterplot",
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
