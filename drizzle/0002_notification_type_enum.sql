CREATE TYPE "notification_type" AS ENUM ('info', 'success', 'warning', 'error');

ALTER TABLE "notifications" ALTER COLUMN "type" SET DATA TYPE notification_type USING "type"::notification_type;
