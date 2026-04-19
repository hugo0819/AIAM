import { regenerateKeys } from "../src/lib/issuer/keys";

(async () => {
  await regenerateKeys();
  console.log("✓ ES256 keys regenerated under ./keys/");
})();
