module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      '@babel/plugin-transform-inline-environment-variables',
      {
        include: ['API_URL'],
      },
    ],
  ],
};
