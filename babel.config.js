const inlineEnvironmentVariables = require('./babel-plugins/inline-environment-variables');

module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      inlineEnvironmentVariables,
      {
        include: ['API_URL'],
      },
    ],
  ],
};
