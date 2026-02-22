module.exports = {
  apps: [
    {
      name: "clawos",
      cwd: ".",
      script: "src/index.ts",
      interpreter: "bun",
      env: {
        NODE_ENV: "production",
        PORT: "26222",
        UPLOAD_TOKEN: "clawos",
      },
    },
  ],
};
