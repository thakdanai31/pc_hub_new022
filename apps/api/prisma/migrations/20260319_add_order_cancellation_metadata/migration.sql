-- AlterTable
ALTER TABLE `Order`
    ADD COLUMN `cancelledByUserId` INTEGER NULL,
    ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    ADD COLUMN `cancelReason` VARCHAR(500) NULL;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_cancelledByUserId_fkey`
    FOREIGN KEY (`cancelledByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
