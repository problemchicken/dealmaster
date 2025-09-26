const fs = require('fs');
const path = require('path');

let envLoaded = false;

const loadEnvFile = () => {
  if (envLoaded) {
    return;
  }

  envLoaded = true;

  const envPath = path.resolve(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const fileContents = fs.readFileSync(envPath, 'utf8');
  fileContents
    .split(/\r?\n/)
    .map(line => line.trim())
    .forEach(line => {
      if (!line || line.startsWith('#')) {
        return;
      }

      const equalsIndex = line.indexOf('=');
      if (equalsIndex === -1) {
        return;
      }

      const key = line.slice(0, equalsIndex).trim();
      if (!key) {
        return;
      }

      let value = line.slice(equalsIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (typeof process.env[key] === 'undefined') {
        process.env[key] = value;
      }
    });
};

module.exports = function inlineEnvironmentVariables(api, options = {}) {
  api.assertVersion(7);
  loadEnvFile();

  const {types: t} = api;
  const include = Array.isArray(options.include)
    ? new Set(options.include)
    : null;

  return {
    name: 'inline-environment-variables-lite',
    visitor: {
      MemberExpression(path) {
        if (!path.matchesPattern('process.env')) {
          return;
        }

        const property = path.get('property');
        let variableName;

        if (property.isIdentifier()) {
          variableName = property.node.name;
        } else if (property.isStringLiteral()) {
          variableName = property.node.value;
        }

        if (!variableName) {
          return;
        }

        if (include && !include.has(variableName)) {
          return;
        }

        const value = process.env[variableName];
        if (typeof value === 'undefined') {
          return;
        }

        path.replaceWith(t.valueToNode(value));
      },
    },
  };
};
