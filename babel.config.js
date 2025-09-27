module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      require('./babel-plugin-inline-environment-variables'),
      {
        include: ['API_URL'],
      },
    ],
  ],
};
