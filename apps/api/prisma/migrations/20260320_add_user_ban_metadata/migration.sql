-- AlterTable
ALTER TABLE `User`
    ADD COLUMN `bannedUntil` DATETIME(3) NULL,
    ADD COLUMN `banReason` VARCHAR(500) NULL,
    ADD COLUMN `bannedAt` DATETIME(3) NULL,
    ADD COLUMN `bannedByUserId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `User_bannedByUserId_idx` ON `User`(`bannedByUserId`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_bannedByUserId_fkey`
    FOREIGN KEY (`bannedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
