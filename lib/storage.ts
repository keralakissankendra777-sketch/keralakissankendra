import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const endpoint = process.env.MINIO_ENDPOINT ?? "http://127.0.0.1:9000";
const region = process.env.MINIO_REGION ?? "us-east-1";
const accessKeyId = process.env.MINIO_ACCESS_KEY ?? "minioadmin";
const secretAccessKey = process.env.MINIO_SECRET_KEY ?? "minioadmin";
const bucket = process.env.MINIO_BUCKET ?? "leafcart-media";
const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function detectImageMime(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return "image/gif";
  }

  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

function publicBaseUrl() {
  const value = process.env.MINIO_PUBLIC_URL?.trim();
  if (value) {
    return value.replace(/\/$/, "");
  }

  return `${endpoint.replace(/\/$/, "")}/${bucket}`;
}

function client() {
  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });
}

export async function uploadProductImage(file: File) {
  if (process.env.NODE_ENV === "production") {
    const required = [
      process.env.MINIO_ENDPOINT,
      process.env.MINIO_ACCESS_KEY,
      process.env.MINIO_SECRET_KEY,
      process.env.MINIO_BUCKET,
      process.env.MINIO_PUBLIC_URL,
    ];
    if (required.some((value) => !value?.trim())) {
      throw new Error("Storage is not configured for production");
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedMime = detectImageMime(buffer);

  if (!detectedMime || !allowedMimeTypes.has(detectedMime)) {
    throw new Error("Invalid or unsupported image file");
  }

  if (file.type && file.type !== detectedMime) {
    throw new Error("Uploaded file type does not match file content");
  }

  const ext = (() => {
    switch (detectedMime) {
      case "image/png":
        return "png";
      case "image/webp":
        return "webp";
      case "image/gif":
        return "gif";
      default:
        return "jpg";
    }
  })();
  const key = `products/${Date.now()}-${randomUUID()}.${ext}`;

  await client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: detectedMime,
      ACL: "public-read",
    }),
  );

  return `${publicBaseUrl()}/${key}`;
}
