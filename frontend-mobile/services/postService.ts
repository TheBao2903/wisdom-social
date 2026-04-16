import { Post } from "@/types";

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fakeCreatePost(post: Post): Promise<Post> {
    await sleep(400);
    return post;
}
