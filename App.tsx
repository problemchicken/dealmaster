import React, {useEffect} from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import {colors} from './src/theme/colors';
import {getDatabase} from './src/storage/database';

const App: React.FC = () => {
  const isDark = useColorScheme() === 'dark';

  useEffect(() => {
    getDatabase();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <AppNavigator />
    </SafeAreaProvider>
  );
};

export default App;
