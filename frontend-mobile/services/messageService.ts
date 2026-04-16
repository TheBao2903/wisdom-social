import { Message } from "@/types";

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fakeSendMessage(message: Message): Promise<Message> {
    await sleep(250);
    return message;
}
