// @flow

/*::
// https://babeljs.io/docs/en/config-files#config-function-api
type ApiType = {
  env: (void | string | Array<string>) => (string | boolean),
  cache: boolean => any,
  ...
};
*/
module.exports = function (api /*: ApiType */) {
  // TODO: think about caching
  api.cache(false)
  return {
    plugins: [
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      '@babel/plugin-proposal-class-properties',
      'nameof-js',
    ],
    sourceMaps: 'inline',
    retainLines: true,
    presets: [
      '@babel/preset-flow',
      [
        '@babel/preset-env',
        {
          useBuiltIns: 'usage',
          corejs: '3',
        },
      ],
    ],
  }
}
