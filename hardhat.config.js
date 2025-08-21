require("@solarity/hardhat-zkit");

module.exports = {
  zkit: {
    compilerVersion: "2.1.9",
    circuitsDir: "circuits",
    compilationSettings: {
      artifactsDir: "zkit/artifacts",
      optimization: "O1",
      // Try multiple include path formats
      includePaths: ["node_modules", "./node_modules", "node_modules/circomlib/circuits"],
    },
    setupSettings: {
      contributionSettings: {
        provingSystem: "groth16",
        contributions: 2,
      },
      ptauDownload: true,
    },
    verifiersSettings: {
      verifiersDir: "contracts/verifiers",
      verifiersType: "sol",
    },
    typesDir: "generated-types/zkit",
  },
};