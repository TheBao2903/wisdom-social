import { useAppContext } from "@/context/AppContext";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function IndexPage() {
    const { loggedIn, bootstrapLoading } = useAppContext();

    if (bootstrapLoading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (!loggedIn) {
        return <Redirect href="/(auth)/login" />;
    }

    return <Redirect href="/(tabs)" />;
}
