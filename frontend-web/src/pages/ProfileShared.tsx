import { useOutletContext } from "react-router-dom";
import ProfileSharedPosts from "../components/profile/ProfileSharedPosts";
import PrivateAccountLock from "../components/profile/PrivateAccountLock";
import type { User } from "../types";

interface OutletContext {
  user: User;
  isOwnProfile: boolean;
}

export default function ProfileShared() {
  const { user, isOwnProfile } = useOutletContext<OutletContext>();

  if (!isOwnProfile && user.isPrivate) {
    return <PrivateAccountLock />;
  }

  return <ProfileSharedPosts userId={user.id} isOwnProfile={isOwnProfile} user={user} />;
}
