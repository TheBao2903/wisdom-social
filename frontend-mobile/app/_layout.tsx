import { AppProvider } from "@/context/AppContext";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

function RootNavigator() {
    return (
        <>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="(stack)" />
            </Stack>
        </>
    );
}

export default function RootLayout() {
    return (
        <AppProvider>
            <RootNavigator />
        </AppProvider>
    );
}
