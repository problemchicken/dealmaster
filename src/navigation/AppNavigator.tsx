import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SpeechTestScreen from '../screens/SpeechTestScreen';
import ChatScreen from '../screens/ChatScreen';
import ChatListScreen from '../screens/ChatListScreen';
import OcrConfirmScreen from '../screens/OcrConfirmScreen';
import {useAuthStore} from '../store/useAuthStore';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen
              name="ChatList"
              component={ChatListScreen}
              options={{title: '對話列表'}}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({route}) => ({
                title: route.params?.title ?? 'Chat',
              })}
            />
            <Stack.Screen
              name="OcrConfirm"
              component={OcrConfirmScreen}
              options={{title: 'OCR 預覽'}}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen
              name="SpeechTest"
              component={SpeechTestScreen}
              options={{title: 'Speech QA'}}
            />
          </>
        ) : (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{headerShown: false}}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
