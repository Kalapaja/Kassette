import { runtimeConfig } from "@/app/config/runtime";

export const environment = {
  production: false,
  projectId: runtimeConfig("projectId", "da9b8666eec49849ccb28bca96afdefa"),
  merchantName: runtimeConfig("merchantName", "JPDesignShop"),
  merchantLogoUrl: runtimeConfig(
    "merchantLogoUrl",
    "https://api.dicebear.com/7.x/shapes/svg?seed=kalatori",
  ),
  apiBaseUrl: "/public",
  ankrApiToken: runtimeConfig("ankrApiToken", '9a25a2f2b2450dd8544183dc50360302908ae16aa19922dd0c824a85cb0b8cfd'),
};
