/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^nanoid$': '<rootDir>/tests/shims/nanoid.cjs',
        '^d3-format$': '<rootDir>/../../node_modules/d3-format/dist/d3-format.js',
        '^d3-time-format$': '<rootDir>/../../node_modules/d3-time-format/dist/d3-time-format.js',
        '^d3-time$': '<rootDir>/../../node_modules/d3-time/dist/d3-time.js',
        '^d3-array$': '<rootDir>/../../node_modules/d3-array/dist/d3-array.js',
    },
    testPathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/tests/e2e/'],
};
