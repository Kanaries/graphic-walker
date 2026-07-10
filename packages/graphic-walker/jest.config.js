/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^nanoid$': '<rootDir>/../../node_modules/nanoid/index.cjs',
    },
    testPathIgnorePatterns: ['<rootDir>/dist/'],
};
