const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl: awsGetSignedUrl } = require('@aws-sdk/s3-request-presigner');
const env = require('./env');

const s3Client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
});

/**
 * Ensure the bucket exists, creating it if necessary.
 * Called once at startup.
 */
async function ensureBucket() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      await s3Client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
      console.log(`Created S3 bucket: ${env.S3_BUCKET}`);
    } else {
      // For s3rver compatibility, try creating anyway
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
        console.log(`Created S3 bucket: ${env.S3_BUCKET}`);
      } catch (createErr) {
        // Bucket may already exist — ignore BucketAlreadyOwnedByYou
        if (createErr.name !== 'BucketAlreadyOwnedByYou' && createErr.name !== 'BucketAlreadyExists') {
          throw createErr;
        }
      }
    }
  }
}

/**
 * Upload a buffer to S3.
 * @param {string} key - S3 object key
 * @param {Buffer} buffer - File content
 * @param {string} contentType - MIME type
 */
async function uploadToS3(key, buffer, contentType) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

/**
 * Generate a short-lived signed URL for an S3 object.
 * Per TRD §4: URLs are scoped to one object, short expiry, generated fresh per request.
 * @param {string} key - S3 object key
 * @returns {Promise<string>} Signed URL
 */
async function getSignedDownloadUrl(key, clientHost = null) {
  let client = s3Client;
  
  // If a clientHost is provided (from req.hostname) in development,
  // we dynamically rewrite the endpoint. This ensures the AWS SDK signs the URL 
  // with the correct Host header so mobile clients on the same LAN can access it
  // and Minio won't reject the signature.
  if (clientHost && env.NODE_ENV === 'development') {
    client = new S3Client({
      endpoint: `http://${clientHost}:4569`,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  }

  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  });
  return awsGetSignedUrl(client, command, { expiresIn: env.SIGNED_URL_EXPIRY });
}

/**
 * Delete an object from S3.
 * @param {string} key - S3 object key
 */
async function deleteFromS3(key) {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    })
  );
}

module.exports = {
  s3Client,
  ensureBucket,
  uploadToS3,
  getSignedDownloadUrl,
  deleteFromS3,
};
