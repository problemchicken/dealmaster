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
      'if (typeof "https://example.com" !== "undefined") {\n  console.log("https://example.com");\n}',
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
      'const { API_URL } = {\n  API_URL: "https://example.com"\n};\nconsole.log(API_URL);',
    );
  });

  it('supports aliased destructuring entries', () => {
    const output = transform(
      'const { API_URL: baseUrl } = process.env;\nconsole.log(baseUrl);',
      pluginOptions,
    );
    expect(output).toBe(
      'const { API_URL: baseUrl } = {\n  API_URL: "https://example.com"\n};\nconsole.log(baseUrl);',
    );
  });

  it('allows regular expressions in the include option', () => {
    const output = transform('const url = process.env.API_URL;', {
      include: [/^API_/],
      env: {API_URL: 'https://example.com'},
    });
    expect(output).toBe('const url = "https://example.com";');
  });

  it('respects regular expression exclusions', () => {
    const output = transform('const url = process.env.API_URL;', {
      include: [/^API_/],
      exclude: [/^API_/],
      env: {API_URL: 'https://example.com'},
    });
    expect(output).toBe('const url = process.env.API_URL;');
  });
});
