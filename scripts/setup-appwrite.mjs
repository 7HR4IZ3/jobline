import { Client, Databases, Storage } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID || "jobs";
const collectionId = process.env.APPWRITE_COLLECTION_ID || "jobs";
const bucketId = process.env.APPWRITE_BUCKET_ID || "job-attachments";

if (!projectId || !apiKey) {
  console.error("Set APPWRITE_PROJECT_ID and APPWRITE_API_KEY before running this script.");
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);
const storage = new Storage(client);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensure(resourceName, getResource, createResource) {
  try {
    return await getResource();
  } catch (error) {
    if (error?.code !== 404) throw error;
    console.log(`Creating ${resourceName}…`);
    return createResource();
  }
}

const database = await ensure(
  "database",
  () => databases.get({ databaseId }),
  () => databases.create({ databaseId, name: "Jobline" }),
);

const collection = await ensure(
  "jobs collection",
  () => databases.getCollection({ databaseId, collectionId }),
  () => databases.createCollection({ databaseId, collectionId, name: "Jobs", documentSecurity: false }),
);

const attributes = await databases.listAttributes({ databaseId, collectionId, total: false });
const existing = new Set(attributes.attributes.map((attribute) => attribute.key));

const stringAttributes = [
  ["name", 200, true],
  ["contact", 200, false],
  ["address", 500, false],
  ["date", 10, true],
  ["startTime", 5, false],
  ["quoteDetails", 20000, false],
  ["jobStatus", 32, true],
  ["paymentStatus", 32, true],
  ["attachments", 65536, false],
  ["createdAt", 40, true],
  ["updatedAt", 40, true],
];

for (const [key, size, required] of stringAttributes) {
  if (existing.has(key)) continue;
  await databases.createStringAttribute({
    databaseId,
    collectionId,
    key,
    size,
    required,
  });
  console.log(`Created attribute ${key}.`);
  await sleep(900);
}

if (!existing.has("durationMinutes")) {
  await databases.createIntegerAttribute({
    databaseId,
    collectionId,
    key: "durationMinutes",
    required: true,
    min: 0,
    max: 1440,
    xdefault: 0,
  });
  console.log("Created attribute durationMinutes.");
  await sleep(900);
}

const bucket = await ensure(
  "attachments bucket",
  () => storage.getBucket({ bucketId }),
  () => storage.createBucket({
    bucketId,
    name: "Job attachments",
    fileSecurity: false,
    maximumFileSize: 25 * 1024 * 1024,
    allowedFileExtensions: ["pdf", "jpg", "jpeg", "png", "webp", "gif", "doc", "docx", "xls", "xlsx", "txt", "csv"],
  }),
);

console.log(`Ready: ${database.name} / ${collection.name} / ${bucket.name}`);
console.log("Keep the resulting IDs in your Vercel environment variables.");
