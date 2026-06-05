import { AppProvider } from "@/context/AppContext";
import GlobalIncomingCallNotifier from "@/components/GlobalIncomingCallNotifier";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

function RootNavigator() {
    return (
        <>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="(stack)" />
                <Stack.Screen name="g" />
            </Stack>
        </>
    );
}

export default function RootLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <AppProvider>
                <RootNavigator />
                <GlobalIncomingCallNotifier />
            </AppProvider>
        </GestureHandlerRootView>
    );
}
