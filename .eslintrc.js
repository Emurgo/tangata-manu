module.exports = {
  extends: "airbnb-base",
  parser: "babel-eslint",
  plugins: [
    "flowtype",
    "mocha"
  ],
  rules: {
    'func-names': 'off',
    "flowtype/define-flow-type": 1,
    "flowtype/use-flow-type": 1,
    "flowtype/require-valid-file-annotation": [2, "always"],
    "flowtype/type-id-match": [
      2,
      "^([A-Z][a-z0-9]+)+Type$"
    ],
    "flowtype/no-primitive-constructor-types": 2,
    "flowtype/no-dupe-keys": 2,
    "no-undef-init": 0, // need this to improve Flow type inference
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    "arrow-parens": "off",
    "function-paren-newline": "off",
    "no-extra-semi": "error",
    'arrow-body-style': 0,
    "camelcase": "off",
    "no-use-before-define": "off",
    "no-await-in-loop": "off",
    "no-plusplus": "off",
    "no-restricted-syntax": [
      "off",
      "ForOfStatement"
    ],
    "no-underscore-dangle": [
      2, { "allow": ["_source", "_wasmv3"] }
    ],
    "prefer-destructuring": ["error", {"object": true, "array": false}],
    "semi": ["error", "never"],
    "import/prefer-default-export": "off"
  },
  env: {
    "jest": true,
    "node": true
  },
  globals: {
    nameof: true,
  }
}
