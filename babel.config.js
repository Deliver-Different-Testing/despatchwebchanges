/**
 * Babel configuration for Jest integration tests
 *
 * Transforms ESM modules (from MSW dependencies) to CommonJS.
 */
module.exports = {
    presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
    ],
};
