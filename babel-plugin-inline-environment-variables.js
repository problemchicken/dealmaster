/* eslint-env node */
'use strict';

module.exports = function inlineEnvironmentVariables({types: t}) {
  function callPathMatcher(path, methodName) {
    if (!path) {
      return false;
    }

    const matcher = path[methodName];
    if (typeof matcher !== 'function') {
      return false;
    }

    return matcher.call(path);
  }

  function toArray(option) {
    if (!option) {
      return null;
    }
    return Array.isArray(option) ? option : [option];
  }

  function getSourceEnv(state) {
    const {opts} = state;
    if (opts && opts.env && typeof opts.env === 'object') {
      return opts.env;
    }
    return process.env;
  }

  function shouldInline(variableName, state) {
    const include = toArray(state.opts && state.opts.include);
    const exclude = toArray(state.opts && state.opts.exclude);

    if (include && include.length > 0 && !include.includes(variableName)) {
      return false;
    }

    if (exclude && exclude.includes(variableName)) {
      return false;
    }

    return true;
  }

  function unwrapTypeCast(path) {
    let current = path;
    while (
      current &&
      (callPathMatcher(current, 'isTSNonNullExpression') ||
        callPathMatcher(current, 'isTSTypeAssertion') ||
        callPathMatcher(current, 'isTSAsExpression') ||
        callPathMatcher(current, 'isTypeCastExpression'))
    ) {
      current = current.get('expression');
    }
    return current;
  }

  function isProcessEnvPath(path) {
    if (!path) {
      return false;
    }

    const node = path.node;
    if (!t.isMemberExpression(node) && !t.isOptionalMemberExpression(node)) {
      return false;
    }

    const property = path.get('property');
    if (node.computed) {
      if (!property.isStringLiteral({value: 'env'})) {
        return false;
      }
    } else if (!property.isIdentifier({name: 'env'})) {
      return false;
    }

    const object = unwrapTypeCast(path.get('object'));
    if (object.isIdentifier({name: 'process'})) {
      return true;
    }

    if (object.isMemberExpression() || object.isOptionalMemberExpression()) {
      return isProcessEnvPath(object);
    }

    return false;
  }

  function getMemberExpressionName(path) {
    const node = path.node;
    const property = path.get('property');

    if (node.computed) {
      if (property.isStringLiteral()) {
        return property.node.value;
      }
      if (
        property.isTemplateLiteral() &&
        property.node.expressions.length === 0 &&
        property.node.quasis.length === 1
      ) {
        return property.node.quasis[0].value.cooked;
      }
      return null;
    }

    if (property.isIdentifier()) {
      return property.node.name;
    }

    if (property.isStringLiteral()) {
      return property.node.value;
    }

    return null;
  }

  function getReplacementNode(variableName, state) {
    const value = getSourceEnv(state)[variableName];
    return value === undefined ? t.identifier('undefined') : t.valueToNode(value);
  }

  function inlineMemberExpression(path, state) {
    const parent = path.parentPath;
    const isTypeofOperand = Boolean(
      parent && parent.isUnaryExpression({operator: 'typeof'}),
    );

    if (!path.isReferenced() && !isTypeofOperand) {
      return;
    }

    const object = unwrapTypeCast(path.get('object'));
    if (!isProcessEnvPath(object)) {
      return;
    }

    const variableName = getMemberExpressionName(path);
    if (!variableName || !shouldInline(variableName, state)) {
      return;
    }

    path.replaceWith(getReplacementNode(variableName, state));
  }

  function getObjectPatternReplacement(patternPath, state) {
    const properties = patternPath.get('properties');
    if (properties.length === 0) {
      return null;
    }

    const replacementProperties = [];

    for (const propertyPath of properties) {
      if (!propertyPath.isObjectProperty()) {
        return null;
      }

      const keyPath = propertyPath.get('key');
      let variableName = null;

      if (propertyPath.node.computed) {
        if (keyPath.isStringLiteral()) {
          variableName = keyPath.node.value;
        } else if (
          keyPath.isTemplateLiteral() &&
          keyPath.node.expressions.length === 0 &&
          keyPath.node.quasis.length === 1
        ) {
          variableName = keyPath.node.quasis[0].value.cooked;
        } else {
          return null;
        }
      } else if (keyPath.isIdentifier()) {
        variableName = keyPath.node.name;
      } else if (keyPath.isStringLiteral()) {
        variableName = keyPath.node.value;
      } else {
        return null;
      }

      if (!variableName || !shouldInline(variableName, state)) {
        return null;
      }

      const replacement = t.objectProperty(
        t.cloneNode(propertyPath.node.key),
        getReplacementNode(variableName, state),
      );
      replacement.computed = propertyPath.node.computed;
      replacementProperties.push(replacement);
    }

    if (replacementProperties.length === 0) {
      return null;
    }

    return t.objectExpression(replacementProperties);
  }

  function maybeInlineObjectPattern(path, state) {
    const init = unwrapTypeCast(path.get(path.isAssignmentExpression() ? 'right' : 'init'));
    if (!init || !isProcessEnvPath(init)) {
      return;
    }

    const patternPath = path.get(path.isAssignmentExpression() ? 'left' : 'id');
    if (!patternPath.isObjectPattern()) {
      return;
    }

    const replacement = getObjectPatternReplacement(patternPath, state);
    if (!replacement) {
      return;
    }

    init.replaceWith(replacement);
  }

  return {
    name: 'inline-environment-variables-local',
    visitor: {
      MemberExpression(path, state) {
        inlineMemberExpression(path, state);
      },
      OptionalMemberExpression(path, state) {
        inlineMemberExpression(path, state);
      },
      VariableDeclarator(path, state) {
        maybeInlineObjectPattern(path, state);
      },
      AssignmentExpression(path, state) {
        maybeInlineObjectPattern(path, state);
      },
    },
  };
};
