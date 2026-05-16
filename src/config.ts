import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-rps-arena",
  description: "Rock-paper-scissors with commit-reveal — provably fair, scan to challenge",
  accentHex: "#84cc16",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
