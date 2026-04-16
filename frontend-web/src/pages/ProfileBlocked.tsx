import { useOutletContext } from "react-router-dom";
import ProfileBlockedUsers from "../components/profile/ProfileBlockedUsers";
import type { User } from "../types";

export default function ProfileBlocked() {
  const { user, isOwnProfile } = useOutletContext<{
    user: User;
    isOwnProfile: boolean;
  }>();

  return (
    <ProfileBlockedUsers userId={user.id} isOwnProfile={isOwnProfile} />
  );
}
