import { app } from "./app";
import { env } from "./config/env";

app.listen(env.PORT, () => {
  console.log(`LinkBox API running on ${env.PORT}`);
});
