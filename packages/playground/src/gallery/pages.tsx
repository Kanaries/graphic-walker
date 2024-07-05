import ExampleWrapper from "./components/Example";
import GalleryGroup, { GalleryItemOption } from "./components/GalleryGroup";

interface SubPage {
    name: string,
    path: string,
    children: GalleryItemOption[],
}

const pagesData: SubPage[] = [
    {
        name: "Line, Area",
        path: "line_area",
        children: [
            {
                id: "bike-sharing-service-line",
                title: "Monitor the Changes of a Bike Sharing Service by Month and Year",
                datasetName: "ds-bikesharing-service",
            },
            {
                id: "bike-sharing-service-area",
                title: "The Seasonal Changes of Casual and Registered Users for a Bike Sharing Service",
                datasetName: "ds-bikesharing-service",
            },
            {
                id: "students-service-area",
                title: "Compare Math Performance of Male and Female Students",
                datasetName: "ds-students-service",
            },
            {
                id: "cars-service-line",
                title: "Compare Miles per Gallon between Three Different Countries",
                datasetName: "ds-cars-service",
            },
        ],
    },
    {
        name: "Bar, Box, Rect",
        path: "bar_box_rect",
        children: [
            {
                id: "bike-sharing-service-bar",
                title: "Seasonal Change of Causal Bike Sharing Users on Working Days and Weekends",
                datasetName: "ds-bikesharing-service",
            },
            {
                id: "carsales-service-bar",
                title: "Compare Sales from Different Manufacturers and Different Models",
                datasetName: "ds-carsales-service"
            },
            {
                id: "students-service-bar",
                title: "What Affects the Students' Math Scores?",
                datasetName: "ds-students-service",
            },
            {
                id: "btcgold-service-box",
                title: "Monitor the Price Change of BTC and Gold by Year",
                datasetName: "ds-btcgold-service",
            },
        ],
    },
    {
        name: "Scatterplot, Heatmap",
        path: "scatterplot_heatmap",
        children: [
            {
                id: "bike-sharing-service-circle",
                title: "Compare the Seasonal Changes of Casual and Registered Users for a Bike Sharing Service",
                datasetName: "ds-bikesharing-service",
            },
            {
                id: "cars-service-heatmap",
                title: "Show the Relationship between Horsepower, Acceleration and Miles per Gallon",
                datasetName: "ds-cars-service",
            },
            {
                id: "students-service-heatmap",
                title: "Monitor Students' Performance in Reading and Writing",
                datasetName: "ds-students-service",
            },
            {
                id: "college-service-scatterplot",
                title: "How State Funding Model Affects U.S. Colleges",
                datasetName: "ds-collage-service",
            },
        ],
    },
    {
        name: "Pie, Tick, Other",
        path: "pie_tick_other",
        children: [
            {
                id: "carsales-service-pie",
                title: "Compare Sales of Main Car Manufacturer",
                datasetName: "ds-carsales-service",
            },
            {
                id: "bike-sharing-service-table",
                title: "Bike Sharing Service Usage Tracker",
                datasetName: "ds-bikesharing-service",
            },
        ],
    }
];

export const pages = pagesData.map(item => ({
    name: item.name,
    path: item.path,
    element: <GalleryGroup title={item.name} path={item.path} items={item.children} />,
    children: item.children.map((item) => ({
        name: item.id,
        path: item.id,
        element: <ExampleWrapper options={item} />,
    })),
}));
