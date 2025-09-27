const { declare } = require('@babel/helper-plugin-utils');

function matchesProcessEnv(path) {
  return path.get('object').matchesPattern('process.env');
}

function getEnvKey(path) {
  const property = path.get('property');

  if (path.node.computed) {
    if (!property.isStringLiteral()) {
      return null;
    }

    return property.node.value;
  }

  if (!property.isIdentifier()) {
    return null;
  }

  return property.node.name;
}

module.exports = declare((api, options = {}) => {
  api.assertVersion(7);

  const t = api.types;
  const include = Array.isArray(options.include) ? new Set(options.include) : null;
  const exclude = Array.isArray(options.exclude) ? new Set(options.exclude) : null;

  function shouldInline(name) {
    if (include && include.size > 0 && !include.has(name)) {
      return false;
    }

    if (exclude && exclude.has(name)) {
      return false;
    }

    return true;
  }

  function buildReplacement(value) {
    if (value === undefined) {
      return t.identifier('undefined');
    }

    return t.valueToNode(value);
  }

  return {
    name: 'transform-inline-environment-variables',
    visitor: {
      MemberExpression(path) {
        if (!matchesProcessEnv(path)) {
          return;
        }

        const envKey = getEnvKey(path);
        if (!envKey || !shouldInline(envKey)) {
          return;
        }

        const replacement = buildReplacement(process.env[envKey]);
        path.replaceWith(replacement);
      },
    },
  };
});
