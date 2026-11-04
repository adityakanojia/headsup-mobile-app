import React, { useCallback } from "react";
import * as FileSystem from "expo-file-system/legacy";
import { useQueryClient } from "@tanstack/react-query";

import CreateProjectWizard from "@/features/jobs/CreateProjectWizard";
import {
  createJob,
  fetchSkillCategories,
  getImageUploadUrl,
} from "@/services/jobService";
import { getNotifications } from "@/services/userService";
import { presentLocalPhoneNotification } from "@/services/pushNotificationService";
import { jobKeys } from "@/hooks/useJobs";
import {
  notificationKeys,
  useNotificationBannerStore,
} from "@/hooks/useNotifications";

import type {
  ImageUploadResponse,
  JobCreatePayload,
  SkillCategory,
} from "@/types/jobs";

type SelectedImage = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

export default function CreateJobScreen() {
  const queryClient = useQueryClient();

  const loadSkills = useCallback(async (): Promise<SkillCategory[]> => {
    return fetchSkillCategories();
  }, []);

  const uploadImage = useCallback(
    async (image: SelectedImage): Promise<string> => {
      const upload: ImageUploadResponse = await getImageUploadUrl(
        image.name,
        image.mimeType,
      );

      if (!upload.upload_url || !upload.public_url) {
        throw new Error("The server did not return the image upload URLs.");
      }

      const result = await FileSystem.uploadAsync(
        upload.upload_url,
        image.uri,
        {
          httpMethod: "PUT",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            "Content-Type": upload.content_type || image.mimeType,
          },
        },
      );

      if (result.status < 200 || result.status >= 300) {
        throw new Error(
          `Image upload failed with HTTP ${result.status}. Please try again.`,
        );
      }

      return upload.public_url;
    },
    [],
  );

  const publishProject = useCallback(
    async (payload: JobCreatePayload, idempotencyKey?: string) => {
      const created = await createJob(payload, idempotencyKey);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: jobKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: jobKeys.clientDashboard() }),
        queryClient.invalidateQueries({ queryKey: jobKeys.all }),
        queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
      ]);

      // Fetch the persisted backend notification for this job submission and display in-app banner
      try {
        const recent = await getNotifications({ limit: 5 });
        const matched = recent.find(
          (n) =>
            n.notification_type === "JOB_SUBMITTED" &&
            n.data?.job_id === created.id,
        );
        if (matched) {
          presentLocalPhoneNotification(matched).catch(() => null);
          useNotificationBannerStore.getState().showBanner(matched);
        }
      } catch {
        // Non-blocking if notification fetch fails
      }

      return created;
    },
    [queryClient],
  );

  return (
    <CreateProjectWizard
      loadSkills={loadSkills}
      uploadImage={uploadImage}
      createProject={publishProject}
    />
  );
}
