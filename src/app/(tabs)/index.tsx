import React from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import { ScreenWrapper } from "@/components/ScreenWrapper";
import { DashboardHeader } from "@/components/DashboardHeader/DashboardHeader";
import { useStore } from "@/store/useStore";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { useUnreadChatCount } from "@/hooks/useChat";
import { colors } from "@/theme";

import { WorkerDashboard } from "@/features/dashboard/WorkerDashboard";
import { ContractorDashboard } from "@/features/dashboard/ContractorDashboard";
import { ClientDashboard } from "@/features/dashboard/ClientDashboard";

export default function DashboardScreen() {
  const router = useRouter();
  const { role, user, isAuthenticated } = useStore();
  const { data: unreadCount = 0 } = useUnreadNotificationCount(isAuthenticated);

  const normalizedRole =
    role === "client" || role === "contractor" ? role : "worker";
  const unreadMessagesCount = useUnreadChatCount(
    isAuthenticated && normalizedRole === "client",
  );

  const dashboard = {
    client: <ClientDashboard />,
    contractor: <ContractorDashboard />,
    worker: <WorkerDashboard />,
  }[normalizedRole];

  return (
    <ScreenWrapper edges={["top", "left", "right"]}>
      <View style={styles.container}>
        <DashboardHeader
          name={user?.name}
          role={normalizedRole}
          unreadMessages={unreadMessagesCount}
          unreadNotifications={unreadCount}
          onPressChat={() => {
            if (normalizedRole === "client") {
              router.push("/messages" as never);
            }
          }}
          onPressNotifications={() => {
            router.push("/notifications");
          }}
          onPressSettings={() => {
            router.push("/(tabs)/profile");
          }}
        />

        {dashboard}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
