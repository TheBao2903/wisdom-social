import { useAppContext } from "@/context/AppContext";
import { Redirect, Stack } from "expo-router";

export default function AuthLayout() {
    const { loggedIn } = useAppContext();

    if (loggedIn) {
        return <Redirect href="/(tabs)" />;
    }

    return <Stack screenOptions={{ headerShown: false }} />;
}
