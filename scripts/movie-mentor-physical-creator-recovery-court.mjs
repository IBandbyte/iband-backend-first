import mongoose from "mongoose";

// This is a physical-environment preflight, NOT the recovery examination.
// It intentionally cannot return a successful recovery certificate.
const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri || !/^mongodb:\/\/127\.0\.0\.1:27017\//.test(uri)) {
  throw new Error("RED PHYSICAL PREFLIGHT: isolated loopback Mongo URI required");
}
try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  const replicaSet = typeof hello.setName === "string" && hello.setName.length > 0;
  console.log("PHYSICAL MONGO PREFLIGHT: loopback connection verified; replicaSet=" + replicaSet);
  if (!replicaSet) {
    throw new Error("RED PHYSICAL PREFLIGHT: Mongo service is standalone; replica-set authority is not established");
  }
  throw new Error("RED PHYSICAL RECOVERY UNIMPLEMENTED: RS256, HTTP, ownership and state read evidence still required");
} finally {
  await mongoose.disconnect();
}
