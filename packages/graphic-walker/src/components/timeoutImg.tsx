import React, { useRef, useState, useEffect } from 'react';

export const ImageWithFallback = (
    props: React.ImgHTMLAttributes<HTMLImageElement> & { fallbackSrc: string; timeout: number }
) => {
    const { src, fallbackSrc, timeout, ...rest } = props;
    const [failed, setFailed] = useState(false);
    const imgLoadedOnInitSrc = useRef(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (!imgLoadedOnInitSrc.current) setFailed(true);
        }, timeout);
        return () => clearTimeout(timer);
    }, []);

    return (
        <img
            {...rest}
            src={failed ? fallbackSrc : src}
            onError={() => {
                setFailed(true);
            }}
            onLoad={() => {
                imgLoadedOnInitSrc.current = true;
            }}
        />
    );
};
