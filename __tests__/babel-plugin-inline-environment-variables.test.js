const {transformSync} = require('@babel/core');
const plugin = require('../babel-plugin-inline-environment-variables');

function transform(code, pluginOptions = {}) {
  return transformSync(code, {
    babelrc: false,
    configFile: false,
    filename: 'file.ts',
    plugins: [[plugin, pluginOptions]],
  }).code;
}

describe('inline environment variables plugin', () => {
  const pluginOptions = {
    include: ['API_URL'],
    env: {API_URL: 'https://example.com'},
  };

  it('replaces member expressions that read process.env', () => {
    const output = transform('const url = process.env.API_URL;', pluginOptions);
    expect(output).toBe('const url = "https://example.com";');
  });

  it('preserves assignments to process.env properties', () => {
    const output = transform(
      'process.env.API_URL = "https://override.example.com";',
      pluginOptions,
    );
    expect(output).toBe('process.env.API_URL = "https://override.example.com";');
  });

  it('replaces references that appear inside typeof expressions', () => {
    const output = transform(
      'if (typeof process.env.API_URL !== "undefined") { console.log(process.env.API_URL); }',
      pluginOptions,
    );
    expect(output).toBe(
      'if (typeof "https://example.com" !== "undefined") { console.log("https://example.com"); }',
    );
  });

  it('replaces optional chained member expressions', () => {
    const output = transform(
      'const url = process.env?.API_URL ?? "https://fallback.example.com";',
      pluginOptions,
    );
    expect(output).toBe(
      'const url = "https://example.com" ?? "https://fallback.example.com";',
    );
  });

  it('supports destructuring object patterns from process.env', () => {
    const output = transform(
      'const { API_URL } = process.env;\nconsole.log(API_URL);',
      pluginOptions,
    );
    expect(output).toBe(
      'const { API_URL } = { API_URL: "https://example.com" };\nconsole.log(API_URL);',
    );
  });

  it('supports aliased destructuring entries', () => {
    const output = transform(
      'const { API_URL: baseUrl } = process.env;\nconsole.log(baseUrl);',
      pluginOptions,
    );
    expect(output).toBe(
      'const { API_URL: baseUrl } = { API_URL: "https://example.com" };\nconsole.log(baseUrl);',
    );
  });
});
