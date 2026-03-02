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
  ankrApiToken: runtimeConfig("ankrApiToken"),
};
