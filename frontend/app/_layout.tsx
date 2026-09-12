import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { Button } from '@/src/components/ui';
import { Brand } from '@/src/components/brand';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar, View, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useIconFonts } from '@/src/hooks/use-icon-fonts';
import { colors } from '@/src/theme';
import { GlobalBottomNav } from '@/src/components/navigation';


SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
        <View style={{ flex: 1, backgroundColor: colors.surface }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface }, animation: 'fade' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
            <Stack.Screen name="(tabs)" />
          </Stack>
          <GlobalBottomNav />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', padding: 24 }}><View style={{ width: '100%', maxWidth: 440, gap: 20 }}><Brand /><Text accessibilityRole="header" style={{ color: colors.onSurface, fontSize: 28, fontWeight: '800' }}>A quick timeout.</Text><Text style={{ color: colors.onSurfaceSecondary, fontSize: 16, lineHeight: 24 }}>This screen couldn’t load correctly. Try again to get back to your game.</Text><Button label="Try again" onPress={retry} /></View></View>;
}
