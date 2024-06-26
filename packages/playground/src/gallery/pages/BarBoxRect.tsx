import { Suspense } from "react";
import Demo from "../components/Demo";
import BikeSharingImage from "../imgs/bike-sharing-user-distribution.webp";
import UserWeatherImage from "../imgs/bike-sharing-user-weather.webp";
import BitcoinVolImage from "../imgs/bitcoin-volatility-index.webp";
import GalleryGroup, { IGalleryItem } from "../components/GalleryGroup";

const groupItems: IGalleryItem[] = [
    {
        name: "bike-sharing-register-user",
        title: "Bike Sharing Register User",
        imageURL: BikeSharingImage,
        datasetURL: "ds-bike-sharing-service",
        specURL: "bike-sharing-service",
    },
    {
        name: "bike-sharing-user-weather",
        title: "Bike Sharing User Weather",
        imageURL: UserWeatherImage,
    },
    {
        name: "bitcoin-volatility-index",
        title: "Bitcoin Volatility Index",
        imageURL: BitcoinVolImage,
    },
    {
        name: "bike-sharing-register-user",
        title: "Bike Sharing Register User",
        imageURL: BikeSharingImage,
    },
    {
        name: "bike-sharing-user-weather",
        title: "Bike Sharing User Weather",
        imageURL: UserWeatherImage,
    },
    {
        name: "bitcoin-volatility-index",
        title: "Bitcoin Volatility Index",
        imageURL: BitcoinVolImage,
    },
    {
        name: "bike-sharing-register-user",
        title: "Bike Sharing Register User",
        imageURL: BikeSharingImage,
    },
    {
        name: "bike-sharing-user-weather",
        title: "Bike Sharing User Weather",
        imageURL: UserWeatherImage,
    },
    {
        name: "bitcoin-volatility-index",
        title: "Bitcoin Volatility Index",
        imageURL: BitcoinVolImage,
    },
];

const name = "Bar, Box, Rect";
const path = name.replace(/\s/g, '_');
const pages = groupItems.map((chart) => ({
    name: chart.name,
    path: chart.name.replace(/\s/g, '_'),
    element: 
    <Suspense fallback={<p>Loading component...</p>}>
            <Demo
            title={chart.title}
            dataURL={chart.datasetURL || `../datasets/db-${name}.json`}
            specURL={chart.specURL || `../specs/${name}.json`}
        />
    </Suspense>,
}));

export default {
    name,
    path,
    element: <GalleryGroup title={name} path={path} items={groupItems}/>,
    children: pages,
};
