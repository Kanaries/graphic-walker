/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/../graphic-walker/src/$1',
        '^nanoid$': '<rootDir>/src/testDoubles/nanoid.js',
    },
    testMatch: ['<rootDir>/src/**/*.test.ts'],
    testTimeout: 30000,
};
