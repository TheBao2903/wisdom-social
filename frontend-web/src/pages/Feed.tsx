import { mockPosts } from "../api/mockData";
import StoriesBar from "../components/story/StoriesBar";
import PostCard from "../components/post/post-card/PostCard";

export default function Feed() {
  return (
    <div>
      {/* Stories */}
      <StoriesBar />

      {/* Posts Feed */}
      <div>
        {mockPosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
