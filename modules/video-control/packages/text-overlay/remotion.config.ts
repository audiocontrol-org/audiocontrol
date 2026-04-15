// See all configuration options: https://remotion.dev/docs/config
// Each option also is available as a CLI flag: https://remotion.dev/docs/cli

// Note: When using the Node.JS APIs, the config file doesn't apply. Instead, pass options directly to the APIs
// All configuration options: https://remotion.dev/docs/config

import { Config } from "@remotion/cli/config";
import path from "path";
import TsconfigPathsPlugin from "tsconfig-paths-webpack-plugin";

Config.setVideoImageFormat("png");
Config.setPixelFormat("yuva444p10le");
Config.setCodec("prores");
Config.setProResProfile("4444");
Config.setMuted(true);

// Configure webpack to resolve @/ alias via tsconfig paths
Config.overrideWebpackConfig((config) => {
  return {
    ...config,
    resolve: {
      ...config.resolve,
      plugins: [
        ...(config.resolve?.plugins ?? []),
        new TsconfigPathsPlugin(),
      ],
      alias: {
        ...config.resolve?.alias,
        "@": path.resolve(__dirname, "src"),
      },
    },
  };
});
