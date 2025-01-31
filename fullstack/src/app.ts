import * as express from "express";
import connect from "./utils/db";
import { Gid } from "./utils/Gid";

const connectUrl = process.env.CONNECT_URL;
const machineId = Number(process.env.MACHINE_ID);
const instanceId = Number(process.env.INSTANCE_ID);
if (!connectUrl) {
  throw Error("ConnectUrl must be string");
}
if (!(machineId === 0 || machineId === 1)) {
  throw Error("MachineId must be 0 or 1");
}
if (
  !(
    instanceId === 0 ||
    instanceId === 1 ||
    instanceId === 2 ||
    instanceId === 3
  )
) {
  throw Error("InstanceId must >= 0 and <= 3");
}

// establish database connection
export const connection = connect(connectUrl);
if (!process.env.DB_NAME) throw Error("Invalid database name");
const db = connection.then((connection) => connection.db(process.env.DB_NAME));

const gidGenerator = new Gid({
  machineId,
  instanceId,
});

const app = express();
app.use(express.json());

// get long link
app.get("/:short_url", async function (req, res) {
  const database = await db;
  const links =
    typeof req.params.short_url === "string"
      ? await database.collection("links").findOne({
          short_url: req.params.short_url,
        })
      : undefined;
  links?.url
    ? res.status(200).send(links?.url)
    : res.status(501).send("Invalid short url");
});

// create short link
app.post("/shortlink", async function (req, res) {
  const { url } = req.body;
  if (typeof url === "string" && url.match(/^http[s]?:\/\/[^/]+/g)) {
    const short_url = gidGenerator.bitToBase64(gidGenerator.generate());
    const database = await db;
    try {
      const { insertedId } = await database.collection("links").insertOne({
        url,
        short_url,
        create_time: Date.now(),
      });
      if (insertedId) return res.status(200).send(`/${short_url}`);
    } catch (error) {
      console.log(error);
    }
    res.status(501).send("Generate failed");
  } else {
    res.status(501).send("Invalid url");
  }
});

// handle 404
app.use((_req, res) => {
  res.status(404).send("404 Not Found");
});

export default app;
