/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^nanoid$': '<rootDir>/tests/shims/nanoid.cjs',
        '^d3-format$': '<rootDir>/../../node_modules/d3-format/dist/d3-format.js',
    },
    testPathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/tests/e2e/'],
};
