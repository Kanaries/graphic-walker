import styled from "styled-components";

export const Container = styled.div`
    border: 1px solid #e5e7eb;
    padding: 1em;
    margin: 1em;
    background-color: #fff;
    // dark theme
    @media (prefers-color-scheme: dark) {
        background-color: #000;
        border: 1px solid #4b5563;
    }
`;

export const NestContainer = styled.div`
    border: 1px solid #e5e7eb;
    padding: 0.4em;
    font-size: 12px;
    margin: 0.2em;
    background-color: #fff;
    @media (prefers-color-scheme: dark) {
        background-color: #000;
        border: 1px solid #4b5563;
    }
`;
