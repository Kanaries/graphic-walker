export const DemoDataAssets = process.env.NODE_ENV === 'production' ? {
    CARS: "https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-cars-service.json",
    STUDENTS: "https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-students-service.json",
    BTC_GOLD: "https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-btcgold-service.json",
    BIKE_SHARING: 'https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-bikesharing-service.json',
    CAR_SALES: 'https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-carsales-service.json',
    COLLAGE: 'https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-collage-service.json',
    TITANIC: 'https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-titanic-service.json',
    KELPER: 'https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-kelper-service.json',
    EARTHQUAKE: 'https://pub-2422ed4100b443659f588f2382cfc7b1.r2.dev/datasets/ds-earthquake-service.json'
} : {
    // CARS: "https://chspace.oss-cn-hongkong.aliyuncs.com/api/ds-cars-service.json",
    CARS: "/datasets/ds-cars-service.json",
    // STUDENTS: "https://chspace.oss-cn-hongkong.aliyuncs.com/datasets/ds-students-service.json",
    STUDENTS: "/datasets/ds-students-service.json",
    BTC_GOLD: "/datasets/ds_btc_gold_service.json",
    BIKE_SHARING: '/datasets/ds-bikesharing-service.json',
    CAR_SALES: '/datasets/ds-carsales-service.json',
    COLLAGE: '/datasets/ds-collage-service.json',
    TITANIC: '/datasets/ds-titanic-service.json',
    KELPER: '/datasets/ds-kelper-service.json',
    EARTHQUAKE: '/datasets/ds-earthquake-service.json'
} as const;

export interface IPublicData {
    key: string;
    title: string;
    desc?: string;
}

export const PUBLIC_DATA_LIST: IPublicData[] = [
    {
        key: "CARS",
        title: "Cars",
    },
    {
        key: "STUDENTS",
        title: "Students' Performance"
    },
    {
        key: "BIKE_SHARING",
        title: "Bike Sharing"
    },
    {
        key: "EARTHQUAKE",
        title: "Earthquakes"
    },
    {
        key: "CAR_SALES",
        title: "Car Sales"
    },
    {
        key: "COLLAGE",
        title: "Collage"
    },
    {
        key: "KELPER",
        title: "NASA Kelper"
    },
    {
        key: 'BTC_GOLD',
        title: "2022MCM Problem C: Trading Strategies"
    },
    {
        key: "TITANIC",
        title: "Titanic"
    }
]