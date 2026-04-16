import { useAppContext } from "@/context/AppContext";
import { Redirect } from "expo-router";

export default function IndexPage() {
    const { loggedIn } = useAppContext();

    if (!loggedIn) {
        return <Redirect href="/(auth)/login" />;
    }

    return <Redirect href="/(tabs)" />;
}
