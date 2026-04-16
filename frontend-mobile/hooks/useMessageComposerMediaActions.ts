import { useCallback } from "react";
import { Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import type { LocalUploadFile } from "@/types/chat";

type SendMixedMedia = (
    files: LocalUploadFile[],
    textOverride?: string,
    replyToId?: string,
) => Promise<boolean>;

interface UseMessageComposerMediaActionsArgs {
    handleSendMixedMedia: SendMixedMedia;
    replyToMessageId?: string;
    uploading: boolean;
    sending: boolean;
    onSendSuccess: () => void;
}

const MAX_CAPTURE_VIDEO_SECONDS = 15;

function toUploadFileFromImageAsset(
    asset: ImagePicker.ImagePickerAsset,
    index: number,
    fallbackPrefix: string,
): LocalUploadFile {
    const fileName =
        asset.fileName ||
        asset.uri.split("/").pop() ||
        `${fallbackPrefix}-${Date.now()}-${index}`;
    const mimeType =
        asset.mimeType || (asset.type === "video" ? "video/mp4" : "image/jpeg");

    return {
        uri: asset.uri,
        fileName,
        mimeType,
        fileSize: asset.fileSize ?? 1,
    };
}

function toUploadFileFromDocumentAsset(
    asset: DocumentPicker.DocumentPickerAsset,
    index: number,
): LocalUploadFile {
    return {
        uri: asset.uri,
        fileName: asset.name || `document-${Date.now()}-${index}`,
        mimeType: asset.mimeType || "application/octet-stream",
        fileSize: asset.size ?? 1,
    };
}

export function useMessageComposerMediaActions({
    handleSendMixedMedia,
    replyToMessageId,
    uploading,
    sending,
    onSendSuccess,
}: UseMessageComposerMediaActionsArgs) {
    const sendFiles = useCallback(
        async (files: LocalUploadFile[]) => {
            if (files.length === 0) return;

            const sent = await handleSendMixedMedia(
                files,
                undefined,
                replyToMessageId,
            );

            if (sent) {
                onSendSuccess();
            }
        },
        [handleSendMixedMedia, onSendSuccess, replyToMessageId],
    );

    const onPickMediaAndSend = useCallback(async () => {
        if (uploading || sending) return;

        try {
            const permission =
                await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert(
                    "Thong bao",
                    "Can cap quyen thu vien anh de gui tep",
                );
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                allowsMultipleSelection: true,
                quality: 1,
                selectionLimit: 20,
            });

            if (result.canceled || result.assets.length === 0) return;

            const files: LocalUploadFile[] = result.assets.map((asset, index) =>
                toUploadFileFromImageAsset(asset, index, "upload"),
            );

            await sendFiles(files);
        } catch {
            Alert.alert("Thong bao", "Khong the chon tep vao luc nay");
        }
    }, [sendFiles, sending, uploading]);

    const onCapturePhotoAndSend = useCallback(async () => {
        if (uploading || sending) return;

        try {
            const permission =
                await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
                Alert.alert("Thong bao", "Can cap quyen camera de chup anh");
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 1,
            });

            if (result.canceled || result.assets.length === 0) return;

            const files: LocalUploadFile[] = result.assets.map((asset, index) =>
                toUploadFileFromImageAsset(asset, index, "camera"),
            );

            await sendFiles(files);
        } catch {
            Alert.alert("Thong bao", "Khong the chup anh vao luc nay");
        }
    }, [sendFiles, sending, uploading]);

    const onCaptureVideoAndSend = useCallback(async () => {
        if (uploading || sending) return;

        try {
            const permission =
                await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
                Alert.alert("Thong bao", "Can cap quyen camera de quay video");
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                quality: 1,
                videoMaxDuration: MAX_CAPTURE_VIDEO_SECONDS,
            });

            if (result.canceled || result.assets.length === 0) return;

            const files: LocalUploadFile[] = result.assets.map((asset, index) =>
                toUploadFileFromImageAsset(asset, index, "camera-video"),
            );

            await sendFiles(files);
        } catch {
            Alert.alert("Thong bao", "Khong the quay video vao luc nay");
        }
    }, [sendFiles, sending, uploading]);

    const onPickDocumentAndSend = useCallback(async () => {
        if (uploading || sending) return;

        try {
            const result = await DocumentPicker.getDocumentAsync({
                multiple: true,
                type: "*/*",
                copyToCacheDirectory: true,
            });

            if (
                result.canceled ||
                !result.assets ||
                result.assets.length === 0
            ) {
                return;
            }

            const files: LocalUploadFile[] = result.assets.map((asset, index) =>
                toUploadFileFromDocumentAsset(asset, index),
            );

            await sendFiles(files);
        } catch {
            Alert.alert("Thong bao", "Khong the chon tep vao luc nay");
        }
    }, [sendFiles, sending, uploading]);

    return {
        onPickMediaAndSend,
        onCapturePhotoAndSend,
        onCaptureVideoAndSend,
        onPickDocumentAndSend,
    };
}
