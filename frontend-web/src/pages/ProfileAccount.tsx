import { useParams, Navigate } from "react-router-dom";

export default function ProfileAccount() {
  const { username } = useParams();

  // Redirect to posts tab by default
  return <Navigate to={`/profile/${username}/posts`} replace />;
}
