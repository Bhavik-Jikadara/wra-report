/*
  Warnings:

  - The primary key for the `admin_boundary` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `exclusion_zones` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `wind_resource` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "layers"."admin_boundary" DROP CONSTRAINT "admin_boundary_parent_id_fkey";

-- DropIndex
DROP INDEX "layers"."exclusion_zones_metadata_idx";

-- DropIndex
DROP INDEX "layers"."wind_resource_metadata_idx";

-- DropIndex
DROP INDEX "layers"."wind_resource_wind_speed_idx";

-- AlterTable
ALTER TABLE "layers"."admin_boundary" DROP CONSTRAINT "admin_boundary_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "parent_id" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "admin_boundary_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "layers"."exclusion_zones" DROP CONSTRAINT "exclusion_zones_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "project_id" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "exclusion_zones_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "layers"."wind_resource" DROP CONSTRAINT "wind_resource_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "wind_resource_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "layers"."admin_boundary" ADD CONSTRAINT "admin_boundary_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "layers"."admin_boundary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "layers"."exclusion_zones_project_active_idx" RENAME TO "exclusion_zones_project_id_idx";
