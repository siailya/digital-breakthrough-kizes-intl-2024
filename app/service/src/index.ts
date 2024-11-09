import { env } from "@/common/utils/envConfig";
import { app } from "@/server";

const server = app.listen(env.PORT, () => {
  const { NODE_ENV, HOST, PORT } = env;
  console.log(`Server (${NODE_ENV}) running on port http://${HOST}:${PORT}`);
});

const onCloseSignal = () => {
  server.close(() => {
    process.exit();
  });
  setTimeout(() => process.exit(1), 10000).unref(); // Force shutdown after 10s
};

process.on("SIGINT", onCloseSignal);
process.on("SIGTERM", onCloseSignal);
