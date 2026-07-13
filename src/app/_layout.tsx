import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_700Bold,
  Rubik_800ExtraBold,
  Rubik_900Black,
  Rubik_400Regular_Italic,
} from '@expo-google-fonts/rubik';
import {
  Raleway_400Regular,
  Raleway_500Medium,
  Raleway_700Bold,
  Raleway_900Black,
  Raleway_400Regular_Italic,
} from '@expo-google-fonts/raleway';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_900Black,
  PlayfairDisplay_400Regular_Italic,
} from '@expo-google-fonts/playfair-display';
import {
  LibreBaskerville_400Regular,
  LibreBaskerville_700Bold,
  LibreBaskerville_400Regular_Italic,
} from '@expo-google-fonts/libre-baskerville';
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';

import { NewsprintColors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

// Crash reporting — enabled only when a DSN is configured (set
// EXPO_PUBLIC_SENTRY_DSN in .env / EAS secrets). Without it this is a no-op,
// so development and CI keep working exactly as before.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    // Crash/error reports only — no session replay, no tracing, no PII.
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enableNativeCrashHandling: true,
  });
}

function RootLayout() {
  const [loaded, fontError] = useFonts({
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_700Bold,
    Rubik_800ExtraBold,
    Rubik_900Black,
    Rubik_400Regular_Italic,
    Raleway_400Regular,
    Raleway_500Medium,
    Raleway_700Bold,
    Raleway_900Black,
    Raleway_400Regular_Italic,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_900Black,
    PlayfairDisplay_400Regular_Italic,
    LibreBaskerville_400Regular,
    LibreBaskerville_700Bold,
    LibreBaskerville_400Regular_Italic,
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  useEffect(() => {
    if (loaded || fontError) SplashScreen.hideAsync();
    if (fontError) console.warn('[fonts] load failed, using system fallback:', fontError.message);
  }, [loaded, fontError]);

  // Never block the app forever on fonts: if loading errors, render with
  // system-font fallback instead of a permanent blank screen.
  if (!loaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: NewsprintColors.ink }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: NewsprintColors.ink },
          animation: 'fade',
        }}
      />
    </GestureHandlerRootView>
  );
}

// Sentry.wrap adds the error boundary + touch tracking when Sentry is
// initialised; it's a transparent pass-through when no DSN is set.
export default Sentry.wrap(RootLayout);
