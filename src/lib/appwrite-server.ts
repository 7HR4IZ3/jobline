import { Client, Databases, Storage } from "node-appwrite";

export const appwriteConfig = {
  endpoint: process.env.APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1",
  projectId: process.env.APPWRITE_PROJECT_ID ?? "",
  apiKey: process.env.APPWRITE_API_KEY ?? "",
  databaseId: process.env.APPWRITE_DATABASE_ID ?? "jobs",
  collectionId: process.env.APPWRITE_COLLECTION_ID ?? "jobs",
  bucketId: process.env.APPWRITE_BUCKET_ID ?? "job-attachments",
};

export function assertAppwriteConfig() {
  const missing = [
    ["APPWRITE_PROJECT_ID", appwriteConfig.projectId],
    ["APPWRITE_API_KEY", appwriteConfig.apiKey],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing Appwrite configuration: ${missing.join(", ")}`);
  }
}

export function getAppwriteServices() {
  assertAppwriteConfig();

  const client = new Client()
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId)
    .setKey(appwriteConfig.apiKey);

  return {
    databases: new Databases(client),
    storage: new Storage(client),
  };
}
