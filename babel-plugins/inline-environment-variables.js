'use strict';

module.exports = function inlineEnvironmentVariables({types: t}) {
  function resolveEnvValue(state, name) {
    const provided = state.opts && state.opts.env ? state.opts.env[name] : undefined;
    const value = provided !== undefined ? provided : process.env?.[name];
    return value === undefined ? undefined : String(value);
  }

  function shouldInline(state, name) {
    if (!name) {
      return false;
    }
    const include = state.opts && Array.isArray(state.opts.include)
      ? state.opts.include
      : undefined;
    return !include || include.includes(name);
  }

  function replaceWithValue(path, state, name) {
    if (!shouldInline(state, name)) {
      return;
    }
    const value = resolveEnvValue(state, name);
    if (value === undefined) {
      path.replaceWith(t.identifier('undefined'));
      return;
    }
    path.replaceWith(t.valueToNode(value));
  }

  function handleMemberExpression(path, state) {
    const objectPath = path.get('object');
    if (!objectPath.isMemberExpression() && !objectPath.isOptionalMemberExpression()) {
      return;
    }
    if (!objectPath.matchesPattern('process.env', true)) {
      return;
    }
    const property = path.node.property;
    let name;
    if (path.node.computed) {
      const evaluated = path.get('property').evaluate();
      if (!evaluated.confident) {
        return;
      }
      name = evaluated.value;
    } else if (property && property.type === 'Identifier') {
      name = property.name;
    }
    replaceWithValue(path, state, name);
  }

  return {
    name: 'inline-environment-variables-local',
    visitor: {
      MemberExpression(path, state) {
        handleMemberExpression(path, state);
      },
      OptionalMemberExpression(path, state) {
        if (!path.matchesPattern('process.env', true)) {
          handleMemberExpression(path, state);
        } else {
          // Optional access like process?.env?.VAR
          const property = path.node.property;
          let name;
          if (path.node.computed) {
            const evaluated = path.get('property').evaluate();
            if (!evaluated.confident) {
              return;
            }
            name = evaluated.value;
          } else if (property && property.type === 'Identifier') {
            name = property.name;
          }
          replaceWithValue(path, state, name);
        }
      },
    },
  };
};
