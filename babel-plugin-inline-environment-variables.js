'use strict';

module.exports = function inlineEnvironmentVariables({types: t}) {
  function isProcessEnv(node) {
    if (!node) {
      return false;
    }

    if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) {
      const {object, property, computed} = node;
      if (computed || !t.isIdentifier(property, {name: 'env'})) {
        return false;
      }
      if (t.isIdentifier(object, {name: 'process'})) {
        return true;
      }
      if (t.isMemberExpression(object) || t.isOptionalMemberExpression(object)) {
        return isProcessEnv(object);
      }
    }

    return false;
  }

  function getVariableName(node) {
    if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) {
      const {property, computed} = node;
      if (computed) {
        return null;
      }
      if (t.isIdentifier(property)) {
        return property.name;
      }
    }
    return null;
  }

  function shouldInline(variableName, state) {
    const include = state.opts && Array.isArray(state.opts.include)
      ? state.opts.include
      : null;
    if (!include || include.length === 0) {
      return true;
    }
    return include.includes(variableName);
  }

  function inlinePath(path, state) {
    const node = path.node;
    if (!isProcessEnv(node.object)) {
      return;
    }
    const variableName = getVariableName(node);
    if (!variableName || !shouldInline(variableName, state)) {
      return;
    }

    const value = process.env[variableName];
    const replacement =
      value === undefined ? t.identifier('undefined') : t.valueToNode(value);

    path.replaceWith(replacement);
  }

  return {
    name: 'inline-environment-variables-local',
    visitor: {
      MemberExpression(path, state) {
        inlinePath(path, state);
      },
      OptionalMemberExpression(path, state) {
        inlinePath(path, state);
      },
    },
  };
};
