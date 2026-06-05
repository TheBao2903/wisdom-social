import { colors } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

type Props = {
  onPress?: () => void;
  size?: number;
  color?: string;
};

export default function NotificationBell({
  onPress,
  size = 24,
  color = colors.text,
}: Props) {
  const router = useRouter();
  const { unreadCount } = useAppContext();

  const handlePress = () => {
    onPress?.();
    router.push("/(stack)/notifications");
  };

  return (
    <Pressable onPress={handlePress} style={styles.container} hitSlop={8}>
      <Ionicons name="notifications-outline" size={size} color={color} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger || "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "700",
  },
});
