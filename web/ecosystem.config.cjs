module.exports = {
  apps: [
    {
      name: "clawos",
      cwd: __dirname,
      script: "bun",
      args: "run src/index.ts",
      interpreter: "none",
      autorestart: true,
      env: {
        NODE_ENV: "production",
        PORT: "26222",
        UPLOAD_TOKEN: "clawos",
      },
    },
  ],
};
