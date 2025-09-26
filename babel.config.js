const inlineEnvPlugin = require('./babel-inline-environment-variables');

module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      inlineEnvPlugin,
      {
        include: ['API_URL'],
      },
    ],
  ],
};
